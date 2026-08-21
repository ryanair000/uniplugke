import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create private password" };

export default async function SetPasswordPage() {
  const viewer = await getViewer();
  if (viewer.user) redirect("/dashboard/settings");

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">⚡</div>
        <p className="eyebrow">Account security</p>
        <h1>Change your password anytime</h1>
        <p>Sign in first, then open Account settings to choose a new private password whenever you are ready.</p>
        <Link className="button button-dark" href="/login">Sign in</Link>
      </div>
    </section>
  );
}
