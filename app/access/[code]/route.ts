import { NextResponse } from "next/server";
import { VIP_ORIGIN } from "@/lib/account-routing";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const ACCESS_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/;

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = String(rawCode || "").trim().toUpperCase();
  if (!ACCESS_CODE_PATTERN.test(code)) return loginError("vip_link_invalid");

  const admin = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();
  if (!admin || !supabase) return loginError("vip_link_invalid");

  const { data: consumed, error: consumeError } = await admin.rpc(
    "uniplug_consume_member_access_link",
    { p_code: code }
  );
  const grant = Array.isArray(consumed) ? consumed[0] : null;
  if (consumeError || !grant?.user_id || !grant?.subscription_id) {
    return loginError("vip_link_expired");
  }

  const userId = String(grant.user_id);
  const subscriptionId = String(grant.subscription_id);

  const [{ data: authUser, error: authUserError }, { data: profile }, { data: portal }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("uniplug_profiles").select("status").eq("user_id", userId).maybeSingle(),
    admin
      .from("client_portal_accounts")
      .select("client_id,must_change_password")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  const authEmail = authUser.user?.email;
  if (
    authUserError ||
    !authEmail ||
    !profile ||
    !["active", "pending"].includes(profile.status) ||
    !portal?.client_id
  ) {
    await supabase.auth.signOut();
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
    await supabase.auth.signOut();
    return loginError("vip_link_invalid");
  }

  const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail
  });
  const tokenHash = generated?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    await supabase.auth.signOut();
    return loginError("vip_link_invalid");
  }

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink"
  });
  if (verifyError || !verified.user || verified.user.id !== userId) {
    await supabase.auth.signOut();
    return loginError("vip_link_invalid");
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
