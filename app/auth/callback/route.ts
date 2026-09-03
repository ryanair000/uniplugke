import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getLokimaxVipAccess,
  storeAccountDestination,
  vipAccountDestination
} from "@/lib/account-routing";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard/subscriptions";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createServerSupabaseClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/login?error=invite_invalid", url.origin));
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=invite_expired", url.origin));
  const user = data.user;
  if (!user) return NextResponse.redirect(new URL("/login?error=invite_invalid", url.origin));
  const [{ data: profile }, initialVipAccess] = await Promise.all([
    supabase.from("uniplug_profiles").select("role,status").eq("user_id", user.id).maybeSingle(),
    getLokimaxVipAccess(supabase, user.id)
  ]);
  const firstLogin = profile?.status === "pending" || initialVipAccess.mustChangePassword;
  let vipAccess = initialVipAccess;
  if (firstLogin) {
    const { error: onboardingError } = await supabase.rpc("uniplug_complete_onboarding");
    if (onboardingError) {
      return NextResponse.redirect(new URL("/login?error=onboarding_failed", url.origin));
    }
    vipAccess = await getLokimaxVipAccess(supabase, user.id);
  }
  const isAdmin = profile?.role === "admin";
  const destination = isAdmin || vipAccess.hasService
    ? vipAccountDestination(false, firstLogin && !isAdmin ? "/dashboard/subscriptions" : next)
    : storeAccountDestination(next);
  return NextResponse.redirect(destination);
}
