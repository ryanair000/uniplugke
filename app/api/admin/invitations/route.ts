import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeKenyanPhone, temporaryPhonePassword } from "@/lib/phone";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function portalEmail(clientId: string) {
  return `portal+${clientId}@members.uniplug.shop`;
}

function portalUsername(clientCode: string | null, clientId: string) {
  const value = String(clientCode || `client-${clientId.slice(0, 8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32);
  return value.length >= 3 ? value : `client-${clientId.slice(0, 8)}`;
}

export async function POST(request: Request) {
  const viewer = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const clientId = String(body.clientId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) {
    return NextResponse.json({ error: "Select a valid tracked client." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Invitation service is not configured." }, { status: 503 });

  const [{ data: client, error: clientError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    admin.from("clients")
      .select("id,client_code,display_name,email,phone,phone_e164,whatsapp,whatsapp_e164,status")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle(),
    admin.from("client_subscriptions")
      .select("id,status,service:client_services!client_subscriptions_service_id_fkey(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
  ]);

  if (clientError || !client) return NextResponse.json({ error: "Tracked client was not found." }, { status: 404 });
  if (subscriptionError) return NextResponse.json({ error: "Tracked services could not be loaded." }, { status: 500 });

  const phoneE164 = normalizeKenyanPhone(client.phone_e164 || client.whatsapp_e164 || client.phone || client.whatsapp);
  if (!phoneE164) {
    return NextResponse.json({ error: "Add a valid Kenyan phone number to this client before inviting them." }, { status: 400 });
  }

  const password = temporaryPhonePassword(phoneE164);
  const username = portalUsername(client.client_code, client.id);
  const authEmail = portalEmail(client.id);
  const contactEmail = client.email ? String(client.email).toLowerCase() : null;

  const { data: existingPortal } = await admin
    .from("client_portal_accounts")
    .select("user_id,client_id")
    .eq("client_id", client.id)
    .maybeSingle();

  let userId = existingPortal?.user_id || null;
  const actionType: "invite" | "recovery" = userId ? "recovery" : "invite";
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { portal_client_id: client.id, portal_account: true }
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      app_metadata: { portal_client_id: client.id, portal_account: true },
      user_metadata: { display_name: client.display_name }
    });
    if (error || !data.user) return NextResponse.json({ error: error?.message || "Portal user could not be created." }, { status: 400 });
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
  if (profileError) return NextResponse.json({ error: "Portal identity was created, but its member profile could not be saved." }, { status: 500 });

  const { error: portalError } = await admin.from("client_portal_accounts").upsert({
    user_id: userId,
    client_id: client.id,
    phone_e164: phoneE164,
    contact_email: contactEmail,
    must_change_password: true,
    updated_at: now
  }, { onConflict: "user_id" });
  if (portalError) return NextResponse.json({ error: portalError.message }, { status: 409 });

  await admin.from("user_roles").upsert({ user_id: userId, role: "user", username }, { onConflict: "user_id" });
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

  const activeServices = (subscriptions || [])
    .filter((subscription) => ["active", "due_soon", "trial"].includes(subscription.status))
    .map((subscription) => {
      const service = subscription.service as unknown as { name?: string } | null;
      return service?.name;
    })
    .filter((name): name is string => Boolean(name));
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.uniplug.shop"}/login`;
  const message = [
    `Hello ${client.display_name}, your UniPlug client dashboard is ready.`,
    activeServices.length ? `Services already linked: ${activeServices.join(", ")}.` : "Your tracked services are linked to your account.",
    `Login: ${loginUrl}`,
    `Phone: ${phoneE164}`,
    `Temporary password: ${password}`,
    "You will be required to choose a private password immediately after signing in.",
    "If an account stops working, open the service and tap Instant replacement."
  ].join("\n");

  return NextResponse.json({
    clientId: client.id,
    displayName: client.display_name,
    phone: phoneE164,
    temporaryPassword: password,
    username,
    serviceCount: subscriptions?.length || 0,
    actionType,
    loginUrl,
    message,
    whatsappUrl: `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
  }, { headers: { "Cache-Control": "no-store" } });
}
