import "server-only";

import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { getClientFamilyIds } from "@/lib/client-identity";
import { normalizePhone } from "@/lib/phone";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

type ClientRow = {
  id: string;
  client_code: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  whatsapp: string | null;
  whatsapp_e164: string | null;
};

type SubscriptionRow = {
  client_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  service?: { name?: string } | Array<{ name?: string }> | null;
};

type AliasRow = { alias_client_id: string; canonical_client_id: string };
type PortalRow = { user_id: string; client_id: string };

export const PORTAL_ELIGIBLE_STATUSES = ["active", "due_soon", "trial"] as const;

const PAGE_SIZE = 1000;

function portalEmail(clientId: string) {
  return `portal+${clientId}@members.uniplug.shop`;
}

function portalUsername(clientCode: string | null, displayName: string | null, clientId: string) {
  const value = String(clientCode || displayName || "client")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return `${value.length >= 3 ? value : "client"}-${clientId.slice(0, 8)}`.slice(0, 32);
}

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}!7aA`;
}

function metadataFlag(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return value === true || value === "true";
}

function resolveCanonicalId(aliasMap: Map<string, string>, clientId: string) {
  let current = clientId;
  const seen = new Set<string>();
  for (let depth = 0; depth < 16 && aliasMap.has(current) && !seen.has(current); depth += 1) {
    seen.add(current);
    current = aliasMap.get(current) || current;
  }
  return current;
}

async function loadAllAliases(admin: AdminClient) {
  const rows: AliasRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("client_identity_aliases")
      .select("alias_client_id,canonical_client_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as AliasRow[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadAllPortalRows(admin: AdminClient) {
  const rows: PortalRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("client_portal_accounts")
      .select("user_id,client_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as PortalRow[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadEligibleSubscriptions(admin: AdminClient) {
  const rows: SubscriptionRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("client_subscriptions")
      .select("client_id,status,metadata")
      .in("status", [...PORTAL_ELIGIBLE_STATUSES])
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as SubscriptionRow[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows.filter((row) => !metadataFlag(row.metadata, "portal_hidden") && !metadataFlag(row.metadata, "interest_only"));
}

async function loadActiveClientIds(admin: AdminClient) {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("clients")
      .select("id")
      .is("deleted_at", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data || []) ids.add(row.id);
    if ((data || []).length < PAGE_SIZE) break;
  }
  return ids;
}

export async function getPortalProvisioningCoverage(admin: AdminClient) {
  const [aliases, portals, subscriptions, activeClientIds] = await Promise.all([
    loadAllAliases(admin),
    loadAllPortalRows(admin),
    loadEligibleSubscriptions(admin),
    loadActiveClientIds(admin)
  ]);
  const aliasMap = new Map(aliases.map((row) => [row.alias_client_id, row.canonical_client_id] as const));
  const eligibleByStatus = new Map<string, Set<string>>();
  const eligibleClientIds = new Set<string>();

  for (const subscription of subscriptions) {
    if (!activeClientIds.has(subscription.client_id)) continue;
    const canonicalId = resolveCanonicalId(aliasMap, subscription.client_id);
    if (!activeClientIds.has(canonicalId)) continue;
    eligibleClientIds.add(canonicalId);
    const statusIds = eligibleByStatus.get(subscription.status) || new Set<string>();
    statusIds.add(canonicalId);
    eligibleByStatus.set(subscription.status, statusIds);
  }

  const portalClientIds = new Set(portals.map((row) => resolveCanonicalId(aliasMap, row.client_id)));
  const missingClientIds = [...eligibleClientIds].filter((clientId) => !portalClientIds.has(clientId)).sort();

  return {
    eligibleClientIds: [...eligibleClientIds].sort(),
    portalClientIds: [...portalClientIds].sort(),
    missingClientIds,
    eligibleCount: eligibleClientIds.size,
    provisionedEligibleCount: eligibleClientIds.size - missingClientIds.length,
    missingCount: missingClientIds.length,
    statusCounts: Object.fromEntries(
      [...eligibleByStatus.entries()].map(([status, ids]) => [status, ids.size])
    ) as Record<string, number>
  };
}

async function findAuthUserByEmail(admin: AdminClient, email: string): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < PAGE_SIZE) return null;
  }
}

async function bestEffort(action: PromiseLike<unknown>) {
  try {
    await action;
  } catch {
    // Telemetry must not mask the primary portal operation.
  }
}

export type PortalProvisioningOptions = {
  initiatedBy?: string | null;
  recordInvitation?: boolean;
  resetCredentials?: boolean;
};

export async function provisionPortalAccount(
  admin: AdminClient,
  selectedClientId: string,
  options: PortalProvisioningOptions = {}
) {
  const { initiatedBy = null, recordInvitation = false, resetCredentials = false } = options;
  let canonicalClientId = selectedClientId;

  try {
    const family = await getClientFamilyIds(admin, selectedClientId);
    canonicalClientId = family.canonicalId;
    const [{ data: client, error: clientError }, { data: subscriptions, error: subscriptionError }, { data: portalRows, error: portalError }] = await Promise.all([
      admin
        .from("clients")
        .select("id,client_code,display_name,email,phone,phone_e164,whatsapp,whatsapp_e164")
        .eq("id", canonicalClientId)
        .is("deleted_at", null)
        .maybeSingle(),
      admin
        .from("client_subscriptions")
        .select("client_id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
        .in("client_id", family.familyIds)
        .in("status", [...PORTAL_ELIGIBLE_STATUSES]),
      admin
        .from("client_portal_accounts")
        .select("user_id,client_id")
        .in("client_id", family.familyIds)
    ]);

    if (clientError || !client) throw clientError || new Error("Tracked client was not found.");
    if (subscriptionError) throw subscriptionError;
    if (portalError) throw portalError;

    const clientRow = client as ClientRow;
    const eligibleSubscriptions = ((subscriptions || []) as unknown as SubscriptionRow[])
      .filter((subscription) => !metadataFlag(subscription.metadata, "portal_hidden") && !metadataFlag(subscription.metadata, "interest_only"));
    if (!eligibleSubscriptions.length) throw new Error("Tracked client has no portal-eligible subscription.");

    const phoneE164 = normalizePhone(clientRow.phone_e164 || clientRow.whatsapp_e164 || clientRow.phone || clientRow.whatsapp);
    const authEmail = portalEmail(clientRow.id);
    const contactEmail = clientRow.email ? String(clientRow.email).toLowerCase() : null;
    const username = portalUsername(clientRow.client_code, clientRow.display_name, clientRow.id);
    const password = temporaryPassword();
    const existingPortal = (portalRows || []).find((row) => row.client_id === canonicalClientId) || portalRows?.[0] || null;

    let authUser: User | null = null;
    if (existingPortal?.user_id) {
      const { data, error } = await admin.auth.admin.getUserById(existingPortal.user_id);
      if (error || !data.user) throw error || new Error("Mapped portal user was not found.");
      authUser = data.user;
    } else {
      authUser = await findAuthUserByEmail(admin, authEmail);
    }

    const appMetadata = {
      ...(authUser?.app_metadata || {}),
      portal_client_id: clientRow.id,
      portal_account: true
    };
    const userMetadata = {
      ...(authUser?.user_metadata || {}),
      display_name: clientRow.display_name
    };

    if (authUser) {
      const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
        ...(resetCredentials ? { email: authEmail, password, email_confirm: true } : {}),
        app_metadata: appMetadata,
        user_metadata: userMetadata
      });
      if (error || !data.user) throw error || new Error("Portal auth identity could not be updated.");
      authUser = data.user;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: userMetadata
      });
      if (error || !data.user) throw error || new Error("Portal auth identity could not be created.");
      authUser = data.user;
    }

    const now = new Date().toISOString();
    const actionType: "invite" | "recovery" = existingPortal ? "recovery" : "invite";
    const { error: profileError } = await admin.from("uniplug_profiles").upsert({
      user_id: authUser.id,
      email: authEmail,
      display_name: clientRow.display_name,
      username,
      phone: phoneE164,
      role: "client",
      status: "active",
      ...(recordInvitation ? { invited_at: now } : {})
    }, { onConflict: "user_id" });
    if (profileError) throw new Error("Portal identity was created, but its member profile could not be saved.");

    const { error: accountError } = await admin.from("client_portal_accounts").upsert({
      user_id: authUser.id,
      client_id: clientRow.id,
      phone_e164: phoneE164,
      contact_email: contactEmail,
      ...(resetCredentials || !existingPortal ? { must_change_password: true } : {}),
      updated_at: now
    }, { onConflict: "user_id" });
    if (accountError) throw accountError;

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: authUser.id, role: "user", username }, { onConflict: "user_id" });
    if (roleError) throw roleError;

    const { error: clientUpdateError } = await admin.from("clients").update({
      portal_access_status: "active",
      portal_sync_error: null,
      portal_sync_updated_at: now
    }).eq("id", clientRow.id);
    if (clientUpdateError) throw clientUpdateError;

    if (recordInvitation) {
      const { error: invitationError } = await admin.from("uniplug_invitations").insert({
        user_id: authUser.id,
        email: authEmail,
        username,
        display_name: clientRow.display_name,
        action_type: actionType,
        status: "created",
        invited_by: initiatedBy,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      if (invitationError) throw invitationError;
    }

    const activeServices = [...new Set(eligibleSubscriptions.map((subscription) => {
      const service = Array.isArray(subscription.service) ? subscription.service[0] : subscription.service;
      return service?.name;
    }).filter((name): name is string => Boolean(name)))];

    await bestEffort(admin.from("integration_sync_events").insert({
      entity_type: "client",
      entity_id: clientRow.id,
      source_system: recordInvitation ? "uniplug" : "lokimax",
      target_system: recordInvitation ? "lokimax" : "uniplug",
      event_type: recordInvitation
        ? (actionType === "invite" ? "portal_account_created" : "portal_account_repaired")
        : "portal_account_provisioned",
      status: "completed",
      metadata: {
        selected_client_id: selectedClientId,
        canonical_client_id: clientRow.id,
        service_count: activeServices.length,
        initiated_by: initiatedBy,
        automatic: !recordInvitation
      },
      processed_at: now
    }));

    return {
      actionType,
      clientId: clientRow.id,
      selectedClientId,
      displayName: clientRow.display_name,
      phone: phoneE164,
      temporaryPassword: password,
      username,
      serviceCount: activeServices.length,
      services: activeServices,
      authEmail
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal member could not be prepared.";
    const now = new Date().toISOString();
    await bestEffort(admin.from("clients").update({
      portal_access_status: "error",
      portal_sync_error: message.slice(0, 1000),
      portal_sync_updated_at: now
    }).eq("id", canonicalClientId));
    await bestEffort(admin.from("integration_sync_events").insert({
      entity_type: "client",
      entity_id: canonicalClientId,
      source_system: "lokimax",
      target_system: "uniplug",
      event_type: "portal_account_sync",
      status: "failed",
      error: message.slice(0, 2000),
      metadata: { selected_client_id: selectedClientId }
    }));
    throw error;
  }
}

export async function reconcileEligiblePortalAccounts(
  admin: AdminClient,
  options: { dryRun?: boolean; limit?: number } = {}
) {
  const dryRun = options.dryRun === true;
  const limit = Math.max(1, Math.min(options.limit || 50, 100));
  const before = await getPortalProvisioningCoverage(admin);
  const targets = before.missingClientIds.slice(0, limit);

  if (dryRun) {
    return {
      dryRun: true,
      eligible: before.eligibleCount,
      provisionedEligible: before.provisionedEligibleCount,
      missing: before.missingCount,
      wouldProvision: targets.length,
      statusCounts: before.statusCounts
    };
  }

  let provisioned = 0;
  let failed = 0;
  for (const clientId of targets) {
    try {
      await provisionPortalAccount(admin, clientId);
      provisioned += 1;
    } catch (error) {
      failed += 1;
      console.error(`[portal-reconcile] ${clientId.slice(0, 8)} failed`, error instanceof Error ? error.message : "unknown error");
    }
  }

  const after = await getPortalProvisioningCoverage(admin);
  return {
    dryRun: false,
    eligible: after.eligibleCount,
    attempted: targets.length,
    provisioned,
    failed,
    remaining: after.missingCount,
    provisionedEligible: after.provisionedEligibleCount,
    statusCounts: after.statusCounts
  };
}
