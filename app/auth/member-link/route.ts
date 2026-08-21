import { NextResponse } from "next/server";
import { VIP_ORIGIN } from "@/lib/account-routing";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const tokenHash = String(url.searchParams.get("token_hash") || "").trim();
  const subscriptionId = String(url.searchParams.get("subscription") || "").trim();

  if (!tokenHash || tokenHash.length > 512 || /\s/.test(tokenHash) || !UUID_PATTERN.test(subscriptionId)) {
    return loginError("vip_link_invalid");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return loginError("vip_link_invalid");

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink"
  });
  if (verifyError || !verified.user) return loginError("vip_link_expired");

  const admin = createAdminSupabaseClient();
  if (!admin) {
    await supabase.auth.signOut();
    return loginError("vip_link_invalid");
  }

  const userId = verified.user.id;
  const [{ data: profile }, { data: portal }] = await Promise.all([
    admin.from("uniplug_profiles").select("status").eq("user_id", userId).maybeSingle(),
    admin
      .from("client_portal_accounts")
      .select("client_id,must_change_password")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (!profile || !["active", "pending"].includes(profile.status) || !portal?.client_id) {
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
