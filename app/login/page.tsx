import { redirect } from "next/navigation";
import { LoginForm, SignOutButton } from "@/components/auth";
import { getViewer } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isKeysStoreRequest } from "@/lib/site-mode";
import {
  getLokimaxVipAccess,
  storeAccountDestination,
  vipAccountDestination
} from "@/lib/account-routing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member sign in" };

function safeNext(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const viewer = await getViewer();
  const query = await searchParams;
  const isMainShop = await isKeysStoreRequest();
  let onboardingFailed = query.error === "onboarding_failed";
  if (viewer.user && viewer.profile && ["active", "pending"].includes(viewer.profile.status)) {
    const supabase = await createServerSupabaseClient();
    let vipAccess = supabase
      ? await getLokimaxVipAccess(supabase, viewer.user.id)
      : { hasService: false, mustChangePassword: false };
    const firstLogin = viewer.profile.status === "pending" || vipAccess.mustChangePassword;
    if (firstLogin && supabase) {
      const { error } = await supabase.rpc("uniplug_complete_onboarding");
      if (error) onboardingFailed = true;
      else vipAccess = await getLokimaxVipAccess(supabase, viewer.user.id);
    }
    const isAdmin = viewer.profile.role === "admin";
    if (!onboardingFailed) {
      redirect(isAdmin || vipAccess.hasService
        ? vipAccountDestination(false, firstLogin && !isAdmin ? "/dashboard/subscriptions" : safeNext(query.next))
        : storeAccountDestination(safeNext(query.next)));
    }
  }
  const nextPath = safeNext(query.next);
  const isCheckout = nextPath === "/checkout";
  const isServiceReturn = nextPath.startsWith("/services/");

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">⚡</div>
        <p className="eyebrow">{isMainShop ? "UniPlug account" : "Lokimax client access"}</p>
        <h1>{isCheckout ? "Sign in to continue checkout" : "Welcome back"}</h1>
        <p>
          {isMainShop
            ? "Sign in to your UniPlug shop account. If Lokimax has a service linked to you, we’ll open the VIP portal automatically."
            : isServiceReturn
            ? "Sign in to return to this service and review dollar prices."
            : "Use the username or email and password from your invitation."}
        </p>
        {viewer.user && onboardingFailed ? (
          <div className="notice">
            <strong>Dashboard setup needs another try</strong>
            <p>Your sign-in succeeded, but we could not prepare your dashboard. Sign out, then sign in again.</p>
            <SignOutButton />
          </div>
        ) : viewer.user && !viewer.profile ? (
          <div className="notice">
            <strong>Access is pending</strong>
            <p>Your sign-in works, but a UniPlug membership profile has not been assigned yet.</p>
            <SignOutButton />
          </div>
        ) : (
          <LoginForm nextPath={nextPath} />
        )}
        {query.error === "membership_required" && <p className="form-error">VIP access requires a service linked to your Lokimax client account.</p>}
        {query.error === "not_configured" && <p className="form-error">Member access is temporarily unavailable. Please contact UniPlug support.</p>}
        <small>{isMainShop ? <>New to UniPlug? <a href="/register">Create an account</a>.</> : "VIP access is reserved for clients with a service in Lokimax."}</small>
      </div>
    </section>
  );
}
