import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { VIP_ORIGIN } from "@/lib/account-routing";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

type ConsumedAccessLink = {
  user_id: string;
  subscription_id: string;
  use_count: number;
  max_uses: number;
  expires_at: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function redirectResponse(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function loginError(error: "vip_link_invalid" | "vip_link_expired" | "onboarding_failed") {
  const url = new URL("/login", VIP_ORIGIN);
  url.searchParams.set("error", error);
  return redirectResponse(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const legacyTokenHash = String(url.searchParams.get("token_hash") || "").trim();
  const subscriptionId = String(url.searchParams.get("subscription") || "").trim();

  if (!UUID_PATTERN.test(subscriptionId)) return loginError("vip_link_invalid");
  if (!token && (!legacyTokenHash || legacyTokenHash.length > 512 || /\s/.test(legacyTokenHash))) {
    return loginError("vip_link_invalid");
  }
  if (token && !ACCESS_TOKEN_PATTERN.test(token)) return loginError("vip_link_invalid");

  const admin = createAdminSupabaseClient();
  if (!admin) return loginError("vip_link_invalid");

  let userId = "";
  let supabase = await createServerSupabaseClient();
  if (!supabase) return loginError("vip_link_invalid");

  const privateTokenHash = token ? hashToken(token) : "";

  if (token) {
    const { data: accessLink, error: accessLinkError } = await admin
      .from("uniplug_member_access_links")
      .select("user_id,subscription_id,expires_at,max_uses,use_count,revoked_at")
      .eq("token_hash", privateTokenHash)
      .eq("subscription_id", subscriptionId)
      .maybeSingle();

    if (
      accessLinkError ||
      !accessLink ||
      accessLink.revoked_at ||
      new Date(accessLink.expires_at).getTime() <= Date.now() ||
      accessLink.use_count >= accessLink.max_uses
    ) {
      return loginError("vip_link_expired");
    }
    userId = accessLink.user_id;
  } else {
    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: legacyTokenHash,
      type: "magiclink"
    });
    if (verifyError || !verified.user) return loginError("vip_link_expired");
    userId = verified.user.id;
  }

  const [{ data: profile }, { data: portal }] = await Promise.all([
    admin.from("uniplug_profiles").select("status").eq("user_id", userId).maybeSingle(),
    admin
      .from("client_portal_accounts")
      .select("client_id,must_change_password")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (!profile || !["active", "pending"].includes(profile.status) || !portal?.client_id) {
    if (!token) await supabase.auth.signOut();
    return loginError("vip_link_invalid");
  }

  const { data: subscription } = await admin
    .from("client_subscriptions")
    .select("id,metadata")
    .eq("id", subscriptionId)
    .eq("client_id", portal.client_id)
    .maybeSingle();
  const metadata = (subscription?.metadata || {}) as Record<string, unknown>;
  if (!subscription || metadata.portal_hidden === true) {
    if (!token) await supabase.auth.signOut();
    return loginError("vip_link_invalid");
  }

  if (token) {
    const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(userId);
    const authEmail = authUser.user?.email;
    if (authUserError || !authEmail) return loginError("vip_link_invalid");

    const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail
    });
    const oneTimeTokenHash = generated?.properties?.hashed_token;
    if (linkError || !oneTimeTokenHash) return loginError("vip_link_invalid");

    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: oneTimeTokenHash,
      type: "magiclink"
    });
    if (verifyError || !verified.user || verified.user.id !== userId) {
      await supabase.auth.signOut();
      return loginError("vip_link_invalid");
    }

    const { data: consumed, error: consumeError } = await admin.rpc(
      "uniplug_consume_member_access_link",
      { p_token_hash: privateTokenHash, p_subscription_id: subscriptionId }
    );
    const consumedLink = (Array.isArray(consumed) ? consumed[0] : consumed) as ConsumedAccessLink | null;
    if (
      consumeError ||
      !consumedLink ||
      consumedLink.user_id !== userId ||
      consumedLink.subscription_id !== subscriptionId
    ) {
      await supabase.auth.signOut();
      return loginError("vip_link_expired");
    }
  }

  if (profile.status === "pending" || portal.must_change_password) {
    const { error: onboardingError } = await supabase.rpc("uniplug_complete_onboarding");
    if (onboardingError) {
      await supabase.auth.signOut();
      return loginError("onboarding_failed");
    }
  }

  const now = new Date().toISOString();
  await admin
    .from("client_portal_accounts")
    .update({ last_login_at: now, updated_at: now })
    .eq("user_id", userId);

  return redirectResponse(new URL(`/dashboard/subscriptions/${subscription.id}`, VIP_ORIGIN));
}
