import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type VerifyAdminAction =
  | "mailbox_connection_tested"
  | "mailbox_credentials_rotated"
  | "mailbox_credentials_revoked"
  | "service_account_credentials_updated"
  | "subscription_enabled"
  | "subscription_disabled"
  | "alert_resolved"
  | "alert_reopened"
  | "provider_governance_updated"
  | "provider_paused"
  | "provider_resumed"
  | "provider_cohort_added"
  | "provider_cohort_removed";

type AdminEventInput = {
  admin: SupabaseClient;
  actorUserId: string;
  action: VerifyAdminAction;
  outcome: string;
  failureCategory?: string | null;
  provider?: string | null;
  mailboxEmail?: string | null;
  subscriptionId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordVerifyAdminEvent({
  admin,
  actorUserId,
  action,
  outcome,
  failureCategory = null,
  provider = null,
  mailboxEmail = null,
  subscriptionId = null,
  metadata = {}
}: AdminEventInput) {
  const { error } = await admin.from("uniplug_verify_admin_events").insert({
    actor_user_id: actorUserId,
    action,
    outcome,
    failure_category: failureCategory,
    provider,
    mailbox_email: mailboxEmail,
    client_subscription_id: subscriptionId,
    metadata
  });
  if (error) throw new Error(`VeriFy audit event failed: ${error.message}`);
}

type AlertCandidate = {
  alertKey: string;
  category: "authentication_failure" | "repeated_no_code" | "unusual_member_activity" | "provider_format_change" | "configuration";
  severity: "low" | "medium" | "high" | "critical";
  provider: string;
  mailboxEmail?: string | null;
  subscriptionId?: string | null;
  occurrenceCount: number;
  safeContext: Record<string, string | number | boolean | null>;
};

type VerifyEvent = {
  client_subscription_id: string | null;
  event_type: string;
  provider: string | null;
  failure_category: string | null;
  created_at: string;
};

type VerifySubscriptionRow = {
  id: string;
  status: string;
  account_reference: string | null;
  verify_enabled: boolean;
  service: { verify_enabled: boolean | null; verify_provider: string | null } | Array<{ verify_enabled: boolean | null; verify_provider: string | null }> | null;
};

function relatedService(row: VerifySubscriptionRow) {
  return Array.isArray(row.service) ? row.service[0] || null : row.service;
}

function isEmail(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

export function verifyWindowStart(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60_000).toISOString();
}

export async function syncVerifyOperationalAlerts(admin: SupabaseClient) {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 60_000).toISOString();
  const [{ data: credentials, error: credentialError }, { data: eventRows, error: eventError }, { data: subscriptionRows, error: subscriptionError }] = await Promise.all([
    admin.from("uniplug_mailbox_credentials").select("mailbox_email,last_error,last_checked_at"),
    admin
      .from("uniplug_household_events")
      .select("client_subscription_id,event_type,provider,failure_category,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2500),
    admin
      .from("client_subscriptions")
      .select("id,status,account_reference,verify_enabled,service:client_services!client_subscriptions_service_id_fkey(verify_enabled,verify_provider)")
      .eq("status", "active")
      .limit(1000)
  ]);
  if (credentialError || eventError || subscriptionError) {
    throw new Error(credentialError?.message || eventError?.message || subscriptionError?.message || "VeriFy operations data failed");
  }

  const candidates = new Map<string, AlertCandidate>();
  const typedSubscriptions = (subscriptionRows || []) as VerifySubscriptionRow[];
  const credentialEmails = new Set((credentials || []).map((row) => String(row.mailbox_email).toLowerCase()));
  const providersByMailbox = new Map<string, Set<string>>();
  for (const subscription of typedSubscriptions) {
    const service = relatedService(subscription);
    const mailboxEmail = subscription.account_reference?.trim().toLowerCase() || null;
    if (!mailboxEmail || !service?.verify_provider || !subscription.verify_enabled || !service.verify_enabled) continue;
    const providers = providersByMailbox.get(mailboxEmail) || new Set<string>();
    providers.add(service.verify_provider);
    providersByMailbox.set(mailboxEmail, providers);
  }

  for (const row of credentials || []) {
    if (!row.last_error) continue;
    const authenticationFailure = String(row.last_error).toLowerCase().includes("authentication");
    const mailboxEmail = String(row.mailbox_email).toLowerCase();
    const providers = [...(providersByMailbox.get(mailboxEmail) || new Set(["netflix"]))];
    for (const provider of providers) {
      const alertKey = `${authenticationFailure ? "auth" : "provider"}:${provider}:${mailboxEmail}`;
      candidates.set(alertKey, {
        alertKey,
        category: authenticationFailure ? "authentication_failure" : "configuration",
        severity: authenticationFailure ? "high" : "medium",
        provider,
        mailboxEmail,
        occurrenceCount: 1,
        safeContext: {
          failureCategory: authenticationFailure ? "mailbox_authentication_failed" : "mailbox_provider_error",
          lastCheckedAt: row.last_checked_at || null
        }
      });
    }
  }

  const events = (eventRows || []) as VerifyEvent[];
  const noCodeBySubscription = new Map<string, VerifyEvent[]>();
  const unusualBySubscription = new Map<string, VerifyEvent[]>();
  for (const event of events) {
    const provider = event.provider || "netflix";
    if (event.event_type === "code_not_found" && event.client_subscription_id) {
      const key = `${provider}:${event.client_subscription_id}`;
      noCodeBySubscription.set(key, [...(noCodeBySubscription.get(key) || []), event]);
    }
    if (["rate_limited", "ip_anomaly"].includes(event.event_type) && event.client_subscription_id) {
      const key = `${provider}:${event.client_subscription_id}`;
      unusualBySubscription.set(key, [...(unusualBySubscription.get(key) || []), event]);
    }
  }

  for (const [key, grouped] of noCodeBySubscription) {
    if (grouped.length < 3) continue;
    const [provider, subscriptionId] = key.split(":");
    const alertKey = `no-code:${provider}:${subscriptionId}`;
    candidates.set(alertKey, {
      alertKey,
      category: "repeated_no_code",
      severity: "medium",
      provider,
      subscriptionId,
      occurrenceCount: grouped.length,
      safeContext: { failureCategory: "no_current_code", windowMinutes: 30 }
    });
  }

  for (const [key, grouped] of unusualBySubscription) {
    const [provider, subscriptionId] = key.split(":");
    const alertKey = `activity:${provider}:${subscriptionId}`;
    candidates.set(alertKey, {
      alertKey,
      category: "unusual_member_activity",
      severity: grouped.some((event) => event.failure_category === "ip_velocity") ? "high" : "medium",
      provider,
      subscriptionId,
      occurrenceCount: grouped.length,
      safeContext: {
        failureCategory: grouped[0]?.failure_category || "member_rate_limit",
        windowMinutes: 30
      }
    });
  }

  const noCodesByProvider = new Map<string, VerifyEvent[]>();
  for (const event of events) {
    if (event.event_type !== "code_not_found" || !event.provider) continue;
    noCodesByProvider.set(event.provider, [...(noCodesByProvider.get(event.provider) || []), event]);
  }
  for (const [provider, providerNoCodes] of noCodesByProvider) {
    const affectedSubscriptions = new Set(providerNoCodes.map((event) => event.client_subscription_id).filter(Boolean));
    if (providerNoCodes.length < 5 || affectedSubscriptions.size < 3) continue;
    const alertKey = `provider-format:${provider}`;
    candidates.set(alertKey, {
      alertKey,
      category: "provider_format_change",
      severity: "high",
      provider,
      occurrenceCount: providerNoCodes.length,
      safeContext: { affectedSubscriptions: affectedSubscriptions.size, windowMinutes: 30 }
    });
  }

  for (const subscription of typedSubscriptions) {
    const service = relatedService(subscription);
    if (!subscription.verify_enabled || !service?.verify_enabled || !service.verify_provider) continue;
    const accountReference = subscription.account_reference?.trim().toLowerCase() || null;
    const failureCategory = !isEmail(accountReference) ? "assignment_missing" : !credentialEmails.has(accountReference!) ? "mailbox_connection_missing" : null;
    if (!failureCategory) continue;
    const alertKey = `configuration:${subscription.id}`;
    candidates.set(alertKey, {
      alertKey,
      category: "configuration",
      severity: "medium",
      provider: service.verify_provider,
      mailboxEmail: isEmail(accountReference) ? accountReference : null,
      subscriptionId: subscription.id,
      occurrenceCount: 1,
      safeContext: { failureCategory }
    });
  }

  const activeKeys = [...candidates.keys()];
  const updatedAt = now.toISOString();
  await Promise.all([...candidates.values()].map(async (candidate) => {
    const { error } = await admin.from("uniplug_verify_alerts").upsert({
      alert_key: candidate.alertKey,
      category: candidate.category,
      severity: candidate.severity,
      provider: candidate.provider,
      mailbox_email: candidate.mailboxEmail || null,
      client_subscription_id: candidate.subscriptionId || null,
      safe_context: candidate.safeContext,
      occurrence_count: candidate.occurrenceCount,
      last_seen_at: updatedAt,
      updated_at: updatedAt
    }, { onConflict: "alert_key" });
    if (error) throw new Error(`VeriFy alert sync failed: ${error.message}`);
  }));

  const { data: openAlerts, error: openAlertError } = await admin
    .from("uniplug_verify_alerts")
    .select("id,alert_key")
    .eq("status", "open");
  if (openAlertError) throw new Error(`VeriFy alert queue failed: ${openAlertError.message}`);
  const activeKeySet = new Set(activeKeys);
  const staleIds = (openAlerts || []).filter((alert) => !activeKeySet.has(alert.alert_key)).map((alert) => alert.id);
  if (staleIds.length) {
    const { error: staleError } = await admin.from("uniplug_verify_alerts").update({
      status: "resolved",
      resolved_at: updatedAt,
      resolved_by: null,
      updated_at: updatedAt
    }).in("id", staleIds);
    if (staleError) throw new Error(`VeriFy stale alert sync failed: ${staleError.message}`);
  }
}
