import { createHash, randomBytes, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { VIP_ORIGIN } from "@/lib/account-routing";
import { getClientFamilyIds } from "@/lib/client-identity";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ACCESS_CODE_LENGTH = 10;
const ACCESS_TTL_HOURS = 48;
const ACCESS_MAX_USES = 3;

function serviceName(value: unknown) {
  const service = Array.isArray(value) ? value[0] : value;
  return (service as { name?: string } | null)?.name || "your service";
}

function createAccessCode() {
  return Array.from(
    { length: ACCESS_CODE_LENGTH },
    () => ACCESS_ALPHABET[randomInt(0, ACCESS_ALPHABET.length)]
  ).join("");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const viewer = await requireAdmin();
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
      .select("user_id,client_id")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (profileError || portalError || !profile || !portal?.client_id) {
    return NextResponse.json({ error: "This member does not have a linked VIP client account." }, { status: 404 });
  }
  if (!["active", "pending"].includes(profile.status)) {
    return NextResponse.json({ error: "Activate this member before creating a VIP access link." }, { status: 409 });
  }

  const family = await getClientFamilyIds(admin, portal.client_id);
  const { data: subscription, error: subscriptionError } = await admin
    .from("client_subscriptions")
    .select("id,client_id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
    .eq("id", subscriptionId)
    .in("client_id", family.familyIds)
    .maybeSingle();

  const metadata = (subscription?.metadata || {}) as Record<string, unknown>;
  if (subscriptionError || !subscription || metadata.portal_hidden === true || metadata.interest_only === true) {
    return NextResponse.json({ error: "That subscription is not available for this member." }, { status: 404 });
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(userId);
  if (authUserError || !authUser.user?.email) {
    return NextResponse.json({ error: "The member login identity could not be loaded." }, { status: 404 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCESS_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error: revokeError } = await admin
    .from("uniplug_member_access_links")
    .update({ revoked_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("subscription_id", subscription.id)
    .is("revoked_at", null);

  if (revokeError) {
    return NextResponse.json({ error: "Existing VIP links could not be rotated safely." }, { status: 500 });
  }

  let code = "";
  let createError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = createAccessCode();
    const token = randomBytes(32).toString("base64url");
    const { error } = await admin.from("uniplug_member_access_links").insert({
      code,
      user_id: userId,
      subscription_id: subscription.id,
      token_hash: hashToken(token),
      created_by: viewer.user.id,
      expires_at: expiresAt,
      max_uses: ACCESS_MAX_USES,
      use_count: 0
    });
    if (!error) {
      createError = null;
      break;
    }
    createError = error;
    if (error.code !== "23505") break;
  }

  if (createError || !code) {
    return NextResponse.json(
      { error: createError?.message || "The secure VIP link could not be created." },
      { status: 500 }
    );
  }

  const serviceLink = new URL(`/access/${code}`, VIP_ORIGIN).toString();
  const portalLinkUrl = new URL(`/access/${code}`, VIP_ORIGIN);
  portalLinkUrl.searchParams.set("destination", "services");
  const portalLink = portalLinkUrl.toString();
  const loginUrl = new URL("/login", VIP_ORIGIN).toString();
  const name = profile.display_name && profile.display_name.toLowerCase() !== "n/a"
    ? profile.display_name
    : `@${profile.username}`;
  const service = serviceName(subscription.service);
  const portalMessage = [
    `Hi ${name} 👋`,
    `Open your UniPlug services: ${portalLink}`,
    `Private link · ${ACCESS_TTL_HOURS} hours · ${ACCESS_MAX_USES} opens.`
  ].join("\n");
  const serviceMessage = [
    `Hi ${name} 👋`,
    `Open ${service}: ${serviceLink}`,
    `Private link · ${ACCESS_TTL_HOURS} hours · ${ACCESS_MAX_USES} opens.`
  ].join("\n");

  return NextResponse.json(
    {
      link: serviceLink,
      loginUrl,
      message: serviceMessage,
      portalLink,
      portalMessage,
      serviceLink,
      serviceMessage,
      serviceName: service,
      username: profile.username,
      phone: profile.phone,
      subscriptionId: subscription.id,
      expiresAt,
      maxUses: ACCESS_MAX_USES,
      usesRemaining: ACCESS_MAX_USES
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
