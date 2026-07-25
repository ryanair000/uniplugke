import { redirect } from "next/navigation";
import { LoginForm, SignOutButton } from "@/components/auth";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await getViewer();
  if (viewer.profile?.status === "active") redirect("/dashboard");
  const query = await searchParams;

  return <section className="auth-page"><div className="auth-card"><div className="auth-icon">⚡</div><p className="eyebrow">Invite-only membership</p><h1>Welcome back</h1><p>Use the email and private password connected to your UniPlug invitation.</p>{viewer.user && !viewer.profile ? <div className="notice"><strong>Access is pending</strong><p>Your sign-in works, but an active UniPlug profile has not been assigned yet.</p><SignOutButton /></div> : <LoginForm />}{query.error === "membership_required" && <p className="form-error">This account does not currently have active UniPlug membership.</p>}<small>There is no public registration. Contact support when an invitation needs to be resent.</small></div></section>;
}
