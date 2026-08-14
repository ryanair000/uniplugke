import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { syncVerifyOperationalAlerts, verifyWindowStart } from "@/lib/verify-operations";
import {
  revokeVerifyMailboxCredential,
  rotateVerifyMailboxCredential,
  setSubscriptionVerifyEnabled,
  setVerifyAlertStatus,
  testVerifyMailbox
} from "@/app/admin/mailboxes/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "VeriFy operations" };

type MailboxCredential = {
  mailbox_email: string;
  connected_at: string;
  last_checked_at: string | null;
  last_error: string | null;
};

type Subscription = {
  id: string;
  client_id: string;
  status: string;
  account_reference: string | null;
  verify_enabled: boolean;
  verify_updated_at: string | null;
  service: { name: string; verify_enabled: boolean; verify_provider: string | null } | Array<{ name: string; verify_enabled: boolean; verify_provider: string | null }> | null;
};

type Client = { id: string; display_name: string | null; email: string | null };

type VerifyEvent = { event_type: string; provider: string | null; created_at: string };
type VerifyAlert = {
  id: string;
  category: string;
  severity: string;
  status: string;
  provider: string;
  mailbox_email: string | null;
  client_subscription_id: string | null;
  safe_context: Record<string, string | number | boolean | null>;
  occurrence_count: number;
  last_seen_at: string;
};
type AdminEvent = {
  id: string;
  action: string;
  outcome: string;
  failure_category: string | null;
  mailbox_email: string | null;
  created_at: string;
};

function related<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] || null : value;
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "Never";
}

const successMessages: Record<string, string> = {
  connection_tested: "Mailbox connection passed without reading any messages.",
  credential_rotated: "Mailbox credential was tested and rotated securely.",
  credential_revoked: "Mailbox credential was revoked immediately.",
  subscription_enabled: "VeriFy was enabled for the subscription.",
  subscription_disabled: "VeriFy was disabled for the subscription.",
  alert_resolved: "Operational alert was resolved.",
  alert_open: "Operational alert was reopened."
};

const errorMessages: Record<string, string> = {
  mailbox_not_connected: "No stored credential exists for that mailbox.",
  mailbox_authentication_failed: "Gmail rejected the credential. Generate a new app password and rotate it below.",
  mailbox_provider_error: "Gmail could not be reached. The existing credential was preserved.",
  invalid_app_password: "Enter a valid Gmail app password.",
  disable_reason_required: "Add a short reason before disabling VeriFy.",
  subscription_not_supported: "That subscription does not support VeriFy."
};

export default async function AdminMailboxesPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");

  await syncVerifyOperationalAlerts(admin);
  const eventSince = verifyWindowStart(24);
  const [credentialResult, subscriptionResult, clientResult, eventResult, alertResult, auditResult] = await Promise.all([
    admin.from("uniplug_mailbox_credentials").select("mailbox_email,connected_at,last_checked_at,last_error").order("mailbox_email"),
    admin
      .from("client_subscriptions")
      .select("id,client_id,status,account_reference,verify_enabled,verify_updated_at,service:client_services!client_subscriptions_service_id_fkey(name,verify_enabled,verify_provider)")
      .order("updated_at", { ascending: false })
      .limit(500),
    admin.from("clients").select("id,display_name,email").limit(1000),
    admin.from("uniplug_household_events").select("event_type,provider,created_at").gte("created_at", eventSince).limit(5000),
    admin.from("uniplug_verify_alerts").select("id,category,severity,status,provider,mailbox_email,client_subscription_id,safe_context,occurrence_count,last_seen_at").order("last_seen_at", { ascending: false }).limit(100),
    admin.from("uniplug_verify_admin_events").select("id,action,outcome,failure_category,mailbox_email,created_at").order("created_at", { ascending: false }).limit(30)
  ]);
  const loadError = credentialResult.error || subscriptionResult.error || clientResult.error || eventResult.error || alertResult.error || auditResult.error;
  if (loadError) throw new Error(`VeriFy operations could not be loaded: ${loadError.message}`);

  const credentials = (credentialResult.data || []) as MailboxCredential[];
  const subscriptions = ((subscriptionResult.data || []) as Subscription[]).filter((subscription) => related(subscription.service)?.verify_enabled);
  const clientMap = new Map(((clientResult.data || []) as Client[]).map((client) => [client.id, client]));
  const events = (eventResult.data || []) as VerifyEvent[];
  const alerts = (alertResult.data || []) as VerifyAlert[];
  const audits = (auditResult.data || []) as AdminEvent[];
  const activeAlerts = alerts.filter((alert) => alert.status === "open");
  const assignedEmails = new Set(subscriptions.map((subscription) => subscription.account_reference?.trim().toLowerCase()).filter(Boolean));
  const unassigned = credentials.filter((credential) => !assignedEmails.has(credential.mailbox_email.toLowerCase()));
  const degraded = credentials.filter((credential) => credential.last_error);
  const successes = events.filter((event) => ["code_found", "code_reused"].includes(event.event_type));
  const noCodes = events.filter((event) => event.event_type === "code_not_found");
  const throttled = events.filter((event) => event.event_type === "rate_limited");
  const completedChecks = successes.length + noCodes.length + events.filter((event) => event.event_type === "mailbox_check_failed").length;
  const successRate = completedChecks ? Math.round((successes.length / completedChecks) * 100) : 0;
  const lastSuccess = successes.map((event) => event.created_at).sort().at(-1) || null;

  return (
    <section className="section shell page-top portal-page verify-ops-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">VeriFy operations</p><h1>Mailbox & code health</h1><p>Diagnose provider failures, manage access safely, and control each eligible subscription without opening a mailbox.</p></div>
        <div className="dashboard-heading-actions"><Link className="button button-light" href="/admin/verify/providers">Provider gates</Link><Link className="button button-light" href="/tools/verify">Open member tool</Link></div>
      </div>
      {query.success && successMessages[query.success] ? <p className="form-success page-notice">{successMessages[query.success]}</p> : null}
      {query.error && errorMessages[query.error] ? <p className="form-error page-notice">{errorMessages[query.error]}</p> : null}
      <p className="form-success page-notice">Connection tests authenticate and open Gmail INBOX read-only. They never search, fetch, or display messages or codes.</p>

      <div className="dashboard-stats verify-ops-stats">
        <article><span>Connected</span><strong>{credentials.length - degraded.length}</strong><small>{degraded.length} degraded</small></article>
        <article><span>Success rate · 24h</span><strong>{successRate}%</strong><small>{successes.length} successful checks</small></article>
        <article><span>No-code · 24h</span><strong>{noCodes.length}</strong><small>{throttled.length} throttled</small></article>
        <article><span>Open alerts</span><strong>{activeAlerts.length}</strong><small>{unassigned.length} unassigned mailboxes</small></article>
      </div>

      <section className="panel verify-ops-provider-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Provider health</p><h2>Netflix</h2></div><span className={`status-pill ${degraded.length ? "status-pending" : "status-active"}`}>{degraded.length ? "Needs attention" : "Operational"}</span></div>
        <div className="verify-provider-metrics"><span><b>{successes.length}</b> codes found</span><span><b>{noCodes.length}</b> no-code results</span><span><b>{throttled.length}</b> throttled</span><span><b>{formatTime(lastSuccess)}</b> last success</span></div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Credential lifecycle</p><h2>Mailbox connections</h2><p>Enter a new Gmail app password to add or rotate a mailbox. It is tested before the stored credential changes.</p></div><span className="status-pill subtle">{credentials.length} stored</span></div>
        <form action={rotateVerifyMailboxCredential} className="verify-credential-form">
          <label>Mailbox email<input name="mailboxEmail" type="email" autoComplete="off" required placeholder="managed-mailbox@gmail.com" /></label>
          <label>New app password<input name="appPassword" type="password" autoComplete="new-password" minLength={12} maxLength={64} required placeholder="16-character Gmail app password" /></label>
          <button className="button button-dark small" type="submit">Test & securely save</button>
        </form>
        <div className="mailbox-account-list verify-mailbox-list">
          {credentials.map((credential) => {
            const health = credential.last_error ? "Degraded" : "Connected";
            return <article key={credential.mailbox_email}>
              <div><strong>{credential.mailbox_email}</strong><span>Connected {formatTime(credential.connected_at)}</span><small>{credential.last_error || `Last tested ${formatTime(credential.last_checked_at)}`}</small></div>
              <span className={`wallet-status ${credential.last_error ? "status-pending" : "status-active"}`}><i />{health}</span>
              <div className="mailbox-actions">
                <form action={testVerifyMailbox}><input name="mailboxEmail" type="hidden" value={credential.mailbox_email} /><button className="button button-light small" type="submit">Safe test</button></form>
                <form action={revokeVerifyMailboxCredential}><input name="mailboxEmail" type="hidden" value={credential.mailbox_email} /><ConfirmSubmitButton className="button button-light small" confirmation={`Revoke VeriFy access to ${credential.mailbox_email} immediately?`}>Revoke</ConfirmSubmitButton></form>
              </div>
            </article>;
          })}
          {!credentials.length ? <div className="empty-state"><h3>No mailbox credentials</h3><p>Add and test the first managed Gmail app password above.</p></div> : null}
        </div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Member controls</p><h2>Eligible subscriptions</h2><p>The service capability and active status still apply; this switch is an additional subscription-level control.</p></div><span className="status-pill subtle">{subscriptions.filter((subscription) => subscription.verify_enabled).length} enabled</span></div>
        <div className="verify-subscription-list">
          {subscriptions.map((subscription) => {
            const client = clientMap.get(subscription.client_id);
            const service = related(subscription.service);
            const assigned = subscription.account_reference?.trim().toLowerCase() || "Unassigned";
            return <article key={subscription.id}>
              <div><strong>{client?.display_name || client?.email || "Member"} · {service?.name || "Service"}</strong><span>{assigned} · {readable(subscription.status)}</span><small>Last control change: {formatTime(subscription.verify_updated_at)}</small></div>
              <span className={`wallet-status ${subscription.verify_enabled ? "status-active" : "status-pending"}`}><i />{subscription.verify_enabled ? "VeriFy enabled" : "VeriFy disabled"}</span>
              <form action={setSubscriptionVerifyEnabled}>
                <input name="subscriptionId" type="hidden" value={subscription.id} />
                <input name="enabled" type="hidden" value={subscription.verify_enabled ? "false" : "true"} />
                {!subscription.verify_enabled ? <input name="reason" type="hidden" value="VeriFy restored by administrator" /> : <input name="reason" maxLength={160} required placeholder="Reason for disabling" />}
                <button className={`button ${subscription.verify_enabled ? "button-light" : "button-dark"} small`} type="submit">{subscription.verify_enabled ? "Disable" : "Enable"}</button>
              </form>
            </article>;
          })}
          {!subscriptions.length ? <div className="empty-state"><h3>No VeriFy-capable subscriptions</h3><p>Enable a reviewed provider capability on a service first.</p></div> : null}
        </div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Operational alerts</p><h2>Actionable signals</h2><p>Provider outages, member instruction misses, authentication failures, and unusual activity remain separate.</p></div><span className="status-pill subtle">{activeAlerts.length} open</span></div>
        <div className="verify-alert-list">
          {alerts.map((alert) => {
            const failureCategory = String(alert.safe_context.failureCategory || alert.category);
            const supportHref = `/admin/requests?verifyProvider=${encodeURIComponent(alert.provider)}&verifyCategory=${encodeURIComponent(failureCategory)}`;
            return <article key={alert.id} className={`severity-${alert.severity}`}>
              <div><span className="status-pill">{alert.severity} · {alert.status}</span><strong>{readable(alert.category)}</strong><p>{alert.mailbox_email || (alert.client_subscription_id ? `Subscription ${alert.client_subscription_id.slice(0, 8)}` : alert.provider)} · {alert.occurrence_count} occurrence{alert.occurrence_count === 1 ? "" : "s"}</p><small>Last seen {formatTime(alert.last_seen_at)} · {readable(failureCategory)}</small></div>
              <div className="verify-alert-actions"><Link className="button button-light small" href={supportHref}>Support shortcut</Link><form action={setVerifyAlertStatus}><input name="alertId" type="hidden" value={alert.id} /><button className="button button-dark small" name="status" value={alert.status === "open" ? "resolved" : "open"} type="submit">{alert.status === "open" ? "Resolve" : "Reopen"}</button></form></div>
            </article>;
          })}
          {!alerts.length ? <div className="empty-state"><h3>No operational alerts</h3><p>VeriFy has no current authentication, provider, instruction, or activity signals.</p></div> : null}
        </div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Audit trail</p><h2>Recent administrator actions</h2></div></div>
        <div className="verify-audit-list">
          {audits.map((event) => <article key={event.id}><div><strong>{readable(event.action)}</strong><span>{event.mailbox_email || event.failure_category || "VeriFy operations"}</span></div><span className={`status-pill ${event.outcome === "success" ? "status-active" : "status-pending"}`}>{readable(event.outcome)}</span><small>{formatTime(event.created_at)}</small></article>)}
          {!audits.length ? <div className="empty-state"><h3>No admin events yet</h3><p>Tests, rotations, revocations, controls, and alert decisions will appear here.</p></div> : null}
        </div>
      </section>
    </section>
  );
}
