import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { getClientFamilyIds } from "@/lib/client-identity";
import { normalizePhone } from "@/lib/phone";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

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
  return `${randomBytes(12).toString("base64url")}!7aA`;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {} as Record<string, unknown>;
}

export async function POST(request: Request) {
  const viewer = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const selectedClientId = String(body.clientId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(selectedClientId)) {
    return NextResponse.json({ error: "Select a valid tracked client." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Invitation service is not configured." }, { status: 503 });

  let canonicalClientId = selectedClientId;
  try {
    const family = await getClientFamilyIds(admin, selectedClientId);
    canonicalClientId = family.canonicalId;

    const [{ data: client, error: clientError }, { data: subscriptions, error: subscriptionError }, { data: portalRows, error: portalError }] = await Promise.all([
      admin.from("clients")
        .select("id,client_code,display_name,email,phone,phone_e164,whatsapp,whatsapp_e164,status,portal_access_status")
        .eq("id", canonicalClientId)
        .is("deleted_at", null)
        .maybeSingle(),
      admin.from("client_subscriptions")
        .select("id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
        .in("client_id", family.familyIds)
        .order("created_at", { ascending: false }),
      admin.from("client_portal_accounts")
        .select("user_id,client_id")
        .in("client_id", family.familyIds)
    ]);

    if (clientError || !client) return NextResponse.json({ error: "Tracked client was not found." }, { status: 404 });
    if (subscriptionError) return NextResponse.json({ error: "Tracked services could not be loaded." }, { status: 500 });
    if (portalError) throw portalError;

    const phoneE164 = normalizePhone(client.phone_e164 || client.whatsapp_e164 || client.phone || client.whatsapp);
    const password = temporaryPassword();
    const username = portalUsername(client.client_code, client.display_name, client.id);
    const authEmail = portalEmail(client.id);
    const contactEmail = client.email ? String(client.email).toLowerCase() : null;
    const existingPortal = (portalRows || []).find((row) => row.client_id === canonicalClientId) || portalRows?.[0] || null;

    let userId = existingPortal?.user_id || null;
    const actionType: "invite" | "recovery" = userId ? "recovery" : "invite";
    if (userId) {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: { portal_client_id: client.id, portal_account: true },
        user_metadata: { display_name: client.display_name }
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: { portal_client_id: client.id, portal_account: true },
        user_metadata: { display_name: client.display_name }
      });
      if (error || !data.user) throw error || new Error("Portal user could not be created.");
      userId = data.user.id;
    }

    const now = new Date().toISOString();
    const { error: profileError } = await admin.from("uniplug_profiles").upsert({
      user_id: userId,
      email: authEmail,
      display_name: client.display_name,
      username,
      phone: phoneE164,
      role: "client",
      status: "active",
      invited_at: now
    }, { onConflict: "user_id" });
    if (profileError) throw new Error("Portal identity was created, but its member profile could not be saved.");

    const { error: accountError } = await admin.from("client_portal_accounts").upsert({
      user_id: userId,
      client_id: client.id,
      phone_e164: phoneE164,
      contact_email: contactEmail,
      must_change_password: true,
      updated_at: now
    }, { onConflict: "user_id" });
    if (accountError) throw accountError;

    const { error: roleError } = await admin.from("user_roles").upsert({ user_id: userId, role: "user", username }, { onConflict: "user_id" });
    if (roleError) throw roleError;

    await admin.from("clients").update({
      portal_access_status: "active",
      portal_sync_error: null,
      portal_sync_updated_at: now
    }).eq("id", client.id);

    await admin.from("uniplug_invitations").insert({
      user_id: userId,
      email: authEmail,
      username,
      display_name: client.display_name,
      action_type: actionType,
      status: "created",
      invited_by: viewer.user.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    const activeServices = [...new Set((subscriptions || [])
      .filter((subscription) => ["active", "due_soon", "trial"].includes(subscription.status))
      .filter((subscription) => {
        const metadata = metadataObject(subscription.metadata);
        return metadata.portal_hidden !== true && metadata.interest_only !== true;
      })
      .map((subscription) => {
        const service = (Array.isArray(subscription.service) ? subscription.service[0] : subscription.service) as { name?: string } | null;
        return service?.name;
      })
      .filter((name): name is string => Boolean(name)))];

    await admin.from("integration_sync_events").insert({
      entity_type: "client",
      entity_id: client.id,
      source_system: "uniplug",
      target_system: "lokimax",
      event_type: actionType === "invite" ? "portal_account_created" : "portal_account_repaired",
      status: "completed",
      metadata: {
        selected_client_id: selectedClientId,
        canonical_client_id: client.id,
        service_count: activeServices.length,
        initiated_by: viewer.user.id
      },
      processed_at: now
    }).catch(() => undefined);

    const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.uniplug.shop"}/login`;
    const message = [
      `Hello ${client.display_name}, your UniPlug client dashboard is ready.`,
      activeServices.length ? `Services already linked: ${activeServices.join(", ")}.` : "Your tracked services are linked to your account.",
      `Login: ${loginUrl}`,
      `Username: ${username}`,
      ...(phoneE164 ? [`Phone: ${phoneE164}`] : []),
      `Temporary password: ${password}`,
      "You will be required to choose a private password immediately after signing in.",
      "Account replacement requests require administrator approval."
    ].join("\n");

    return NextResponse.json({
      clientId: client.id,
      selectedClientId,
      displayName: client.display_name,
      phone: phoneE164,
      temporaryPassword: password,
      username,
      serviceCount: activeServices.length,
      services: activeServices,
      actionType,
      loginUrl,
      message,
      whatsappUrl: phoneE164 ? `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal member could not be prepared.";
    const now = new Date().toISOString();
    await admin.from("clients").update({
      portal_access_status: "error",
      portal_sync_error: message.slice(0, 1000),
      portal_sync_updated_at: now
    }).eq("id", canonicalClientId).catch(() => undefined);
    await admin.from("integration_sync_events").insert({
      entity_type: "client",
      entity_id: canonicalClientId,
      source_system: "uniplug",
      target_system: "lokimax",
      event_type: "portal_account_sync",
      status: "failed",
      error: message.slice(0, 2000),
      metadata: { selected_client_id: selectedClientId }
    }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
