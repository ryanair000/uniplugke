import { redirect } from "next/navigation";
import { LoginForm, SignOutButton } from "@/components/auth";
import { getViewer } from "@/lib/auth";

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
  if (viewer.profile?.status === "active") redirect(safeNext(query.next));
  const nextPath = safeNext(query.next);
  const isCheckout = nextPath === "/checkout";
  const isServiceReturn = nextPath.startsWith("/services/");

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">⚡</div>
        <p className="eyebrow">Invite-only membership</p>
        <h1>{isCheckout ? "Sign in to continue checkout" : "Welcome back"}</h1>
        <p>
          {isServiceReturn
            ? "Sign in to return to this service and review prices in KSh and USD."
            : "Use the username or email from your invitation and the private password you created."}
        </p>
        {viewer.user && viewer.profile?.status === "pending" ? (
          <div className="notice">
            <strong>Finish setting up your account</strong>
            <p>Your invitation is confirmed. Create your private password to activate the member dashboard.</p>
            <a className="button button-dark" href="/set-password">Create password</a>
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
        {query.error === "membership_required" && <p className="form-error">This storefront is available only to invited clients with an active UniPlug membership.</p>}
        {query.error === "not_configured" && <p className="form-error">Member access is temporarily unavailable. Please contact UniPlug support.</p>}
        <div className="auth-support-actions">
          <a href="https://wa.me/254113033475?text=Hi%20UniPlug%2C%20I%20need%20help%20with%20member%20access%20or%20my%20invitation.">
            Get help with your invitation
          </a>
        </div>
        <small>There is no public registration. Only clients invited by UniPlug can sign in.</small>
      </div>
    </section>
  );
}
