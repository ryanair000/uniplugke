import Link from "next/link";
import { updateMemberPassword, updateMemberProfile } from "@/app/settings/actions";
import { requireMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile and security" };

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const viewer = await requireMember();
  const query = await searchParams;

  return (
    <section className="section shell page-top">
      <Link className="back-link" href="/dashboard">← Back to My UniPlug</Link>
      <div className="page-heading settings-heading">
        <p className="eyebrow">Member settings</p>
        <h1>Profile & security</h1>
        <p>Manage the identity, contact preferences, and private password connected to your UniPlug membership.</p>
      </div>

      {query.success ? <p className="form-success page-notice">{query.success}</p> : null}
      {query.error ? <p className="form-error page-notice">{query.error}</p> : null}

      <div className="settings-grid">
        <section className="panel">
          <p className="eyebrow">Profile</p>
          <h2>Member information</h2>
          <form action={updateMemberProfile} className="admin-form settings-form">
            <label className="field">Display name<input name="displayName" defaultValue={viewer.profile.displayName || ""} maxLength={100} placeholder="Your name" /></label>
            <label className="field">Username<input name="username" defaultValue={viewer.profile.username} minLength={3} maxLength={32} pattern="[a-z0-9._-]{3,32}" required /></label>
            <label className="field">Email<input value={viewer.profile.email} disabled aria-describedby="email-help" /></label>
            <small id="email-help" className="field-help">Contact support to change the email connected to an invitation.</small>
            <label className="field">Phone number<input name="phone" inputMode="tel" autoComplete="tel" defaultValue={viewer.profile.phone || ""} placeholder="+254…" /></label>
            <div className="preference-list">
              <label><input name="renewalRemindersEnabled" type="checkbox" defaultChecked={viewer.profile.renewalRemindersEnabled} /><span><strong>Renewal reminders</strong><small>Receive reminders before a service period ends.</small></span></label>
              <label><input name="marketingOptIn" type="checkbox" defaultChecked={viewer.profile.marketingOptIn} /><span><strong>Member offers</strong><small>Allow occasional UniPlug service and plan updates.</small></span></label>
            </div>
            <button className="button button-dark">Save profile settings</button>
          </form>
        </section>

        <section className="panel security-panel">
          <p className="eyebrow">Security</p>
          <h2>Change private password</h2>
          <p>Use a unique password that you do not reuse on streaming, email, or social accounts.</p>
          <form action={updateMemberPassword} className="admin-form settings-form">
            <label className="field">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
            <label className="field">Confirm new password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={10} required /></label>
            <button className="button button-dark">Update password</button>
          </form>
          <div className="security-note">
            <strong>Account status: {viewer.profile.status}</strong>
            <p>Your password is never displayed in the dashboard or included in an invitation link.</p>
          </div>
        </section>
      </div>
    </section>
  );
}
