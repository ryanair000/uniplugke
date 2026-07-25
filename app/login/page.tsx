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

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">⚡</div>
        <p className="eyebrow">Invite-only membership</p>
        <h1>Welcome back</h1>
        <p>Use the username or email from your invitation and the private password you created.</p>
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
          <LoginForm nextPath={safeNext(query.next)} />
        )}
        {query.error === "membership_required" && <p className="form-error">This account does not currently have active UniPlug membership.</p>}
        <small>There is no public registration. Contact support when an invitation needs to be resent.</small>
      </div>
    </section>
  );
}
