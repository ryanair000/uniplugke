import { updateMemberPassword, updateMemberProfile } from "@/app/settings/actions";
import { StatusBadge } from "@/components/member-dashboard";
import { requireMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const viewer = await requireMember();
  const query = await searchParams;

  return (
    <section className="member-page">
      <div className="dashboard-heading dashboard-heading-v2">
        <div><p className="eyebrow">Account</p><h1>Profile & security</h1><p>Manage your identity, contact preferences and private member password.</p></div>
        <StatusBadge status={viewer.profile.status} label={`Account ${viewer.profile.status}`} />
      </div>

      {query.success ? <p className="form-success page-notice">{query.success}</p> : null}
      {query.error ? <p className="form-error page-notice">{query.error}</p> : null}

      <div className="account-grid">
        <section className="panel account-profile-panel">
          <p className="eyebrow">Profile</p>
          <h2>Member information</h2>
          <p className="muted-copy">Keep the details UniPlug uses for account and service communication up to date.</p>
          <form action={updateMemberProfile} className="admin-form settings-form">
            <label className="field">Display name<input name="displayName" defaultValue={viewer.profile.displayName || ""} maxLength={100} placeholder="Your name" /></label>
            <label className="field">Username<input name="username" defaultValue={viewer.profile.username} minLength={3} maxLength={32} pattern="[a-z0-9._-]{3,32}" required /></label>
            <label className="field">Email<input value={viewer.profile.email} disabled aria-describedby="email-help" /></label>
            <small id="email-help" className="field-help">Contact UniPlug support to change the email tied to your invitation.</small>
            <label className="field">Phone / WhatsApp<input name="phone" inputMode="tel" autoComplete="tel" defaultValue={viewer.profile.phone || ""} placeholder="+254…" /></label>

            <div className="account-subsection">
              <div><p className="eyebrow">Notifications</p><h3>Communication preferences</h3></div>
              <div className="preference-list">
                <label><input name="renewalRemindersEnabled" type="checkbox" defaultChecked={viewer.profile.renewalRemindersEnabled} /><span><strong>Renewal reminders</strong><small>Receive reminders before a service period ends.</small></span></label>
                <label><input name="marketingOptIn" type="checkbox" defaultChecked={viewer.profile.marketingOptIn} /><span><strong>Member offers</strong><small>Allow occasional UniPlug service and plan updates.</small></span></label>
              </div>
              <p className="field-help standalone">Important payment, activation and account-security messages may still be sent when needed to operate your account.</p>
            </div>

            <button className="button button-dark">Save account settings</button>
          </form>
        </section>

        <div className="account-side-column">
          <section className="panel security-panel">
            <p className="eyebrow">Security</p>
            <h2>Change private password</h2>
            <p>Use a unique password you do not reuse on streaming, email or social accounts.</p>
            <form action={updateMemberPassword} className="admin-form settings-form">
              <label className="field">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
              <label className="field">Confirm new password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={10} required /></label>
              <button className="button button-dark">Update password</button>
            </form>
            <div className="security-note"><strong>Password safety</strong><p>Your password is never displayed in the dashboard or included in an invitation or support message.</p></div>
          </section>

          <section className="panel account-summary-card">
            <p className="eyebrow">Membership</p>
            <h2>@{viewer.profile.username}</h2>
            <dl className="detail-list compact-detail-list">
              <div><dt>Status</dt><dd><StatusBadge status={viewer.profile.status} /></dd></div>
              <div><dt>Role</dt><dd>{viewer.profile.role === "admin" ? "Administrator" : "Member"}</dd></div>
              <div><dt>Email</dt><dd>{viewer.profile.email}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </section>
  );
}
