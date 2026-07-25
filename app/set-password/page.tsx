import Link from "next/link";
import { PasswordSetupForm } from "@/components/password-setup";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create private password" };

export default async function SetPasswordPage() {
  const viewer = await getViewer();

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">⚡</div>
        <p className="eyebrow">Secure your membership</p>
        <h1>Create your private password</h1>
        <p>Your username and password are separate. UniPlug support will never ask you to send this password.</p>
        {viewer.user ? (
          <PasswordSetupForm />
        ) : (
          <div className="notice">
            <strong>The invitation session is missing or expired.</strong>
            <p>Open the complete invitation link again, or ask an administrator to generate a new one.</p>
            <Link className="button button-dark" href="/login">Back to sign in</Link>
          </div>
        )}
      </div>
    </section>
  );
}
