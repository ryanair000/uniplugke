import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { VIP_ORIGIN } from "@/lib/account-routing";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceName(value: unknown) {
  const service = Array.isArray(value) ? value[0] : value;
  return (service as { name?: string } | null)?.name || "your service";
}

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId || "").trim();
  const subscriptionId = String(body.subscriptionId || "").trim();

  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(subscriptionId)) {
    return NextResponse.json({ error: "Select a valid member and subscription." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return NextResponse.json({ error: "VIP access links are not configured." }, { status: 503 });
  }

  const [{ data: profile, error: profileError }, { data: portal, error: portalError }] = await Promise.all([
    admin
      .from("uniplug_profiles")
      .select("user_id,display_name,username,phone,status")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("client_portal_accounts")
      .select("user_id,client_id,must_change_password")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (profileError || portalError || !profile || !portal?.client_id) {
    return NextResponse.json({ error: "This member does not have a linked VIP client account." }, { status: 404 });
  }
  if (!["active", "pending"].includes(profile.status)) {
    return NextResponse.json({ error: "Activate this member before creating a VIP access link." }, { status: 409 });
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("client_subscriptions")
    .select("id,client_id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
    .eq("id", subscriptionId)
    .eq("client_id", portal.client_id)
    .maybeSingle();

  const metadata = (subscription?.metadata || {}) as Record<string, unknown>;
  if (subscriptionError || !subscription || metadata.portal_hidden === true) {
    return NextResponse.json({ error: "That subscription is not available for this member." }, { status: 404 });
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(userId);
  const authEmail = authUser.user?.email;
  if (authUserError || !authEmail) {
    return NextResponse.json({ error: "The member login identity could not be loaded." }, { status: 404 });
  }

  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail
  });
  const tokenHash = generated?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.json({ error: linkError?.message || "The secure VIP link could not be created." }, { status: 400 });
  }

  const vipLink = new URL("/auth/member-link", VIP_ORIGIN);
  vipLink.searchParams.set("token_hash", tokenHash);
  vipLink.searchParams.set("subscription", subscription.id);

  const loginUrl = new URL("/login", VIP_ORIGIN).toString();
  const name = profile.display_name || `@${profile.username}`;
  const service = serviceName(subscription.service);
  const message = [
    `Hi ${name} 👋`,
    "",
    `Welcome to UniPlug VIP Shop. Your ${service} subscription is ready.`,
    "",
    `VIP Shop: ${loginUrl}`,
    `Username: @${profile.username}`,
    ...(profile.phone ? [`Phone: ${profile.phone}`] : []),
    `Secure one-tap access: ${vipLink.toString()}`,
    "",
    `Tap the secure link above to sign in automatically and go straight to your ${service} subscription.`,
    "For future visits, use your username or phone and your private password on the VIP Shop login page.",
    "The one-tap link is single-use, so please keep it private and do not forward it.",
    "",
    "Enjoy your subscription 💜",
    "— UniPlug"
  ].join("\n");

  return NextResponse.json(
    {
      link: vipLink.toString(),
      loginUrl,
      message,
      serviceName: service,
      username: profile.username,
      phone: profile.phone,
      subscriptionId: subscription.id
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
