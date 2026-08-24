import Link from "next/link";
import { AdminDrawer } from "@/components/admin-drawer";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminTabs, AdminToolbar } from "@/components/admin-console";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { syncVerifyOperationalAlerts, verifyWindowStart } from "@/lib/verify-operations";
import {
  revokeVerifyMailboxCredential,
  rotateVerifyMailboxCredential,
  setSubscriptionVerifyEnabled,
  setVerifyAlertStatus,
  testVerifyMailbox,
  updateVerifyAccountCredentials
} from "@/app/admin/mailboxes/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "VeriFy operations" };

type MailboxCredential = {
  mailbox_email: string;
  connected_at: string;
  last_checked_at: string | null;
  last_error: string | null;
};

type ManagedAccount = {
  id: string | null;
  account_mail: string | null;
  service_name: string | null;
  game: string | null;
  profile_name: string | null;
  password_secret_id: string | null;
};

type Slot = { id: string; account: string | null; status: string; expiry_date: string | null };

type Subscription = {
  id: string;
  client_id: string;
  status: string;
  account_reference: string | null;
  verify_enabled: boolean;
  verify_updated_at: string | null;
  metadata: Record<string, unknown> | null;
  service: { name: string; verify_enabled: boolean; verify_provider: string | null } | Array<{ name: string; verify_enabled: boolean; verify_provider: string | null }> | null;
};

type Client = { id: string; display_name: string | null; email: string | null; phone: string | null };
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

function normalized(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function assignedAccountId(metadata: Record<string, unknown> | null) {
  const value = metadata?.assigned_account_id;
  return typeof value === "string" ? value : null;
}

const successMessages: Record<string, string> = {
  connection_tested: "Mailbox connection passed the safe test.",
  credential_rotated: "Gmail app password was tested and securely saved.",
  credential_revoked: "Mailbox credential was revoked.",
  account_updated: "Service account details were updated.",
  subscription_enabled: "VeriFy was enabled for the subscription.",
  subscription_disabled: "VeriFy was disabled for the subscription.",
  alert_resolved: "Operational alert was resolved.",
  alert_open: "Operational alert was reopened."
};

const errorMessages: Record<string, string> = {
  mailbox_not_connected: "No app password is stored for that mailbox.",
  mailbox_authentication_failed: "Gmail rejected the app password. Generate a new one and save it here.",
  mailbox_provider_error: "Gmail could not be reached. The existing credential was preserved.",
  invalid_app_password: "Enter a valid Gmail app password.",
  disable_reason_required: "Add a short reason before disabling VeriFy.",
  subscription_not_supported: "That subscription does not support VeriFy."
};

export default async function AdminMailboxesPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string; view?: string; state?: string; search?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const validViews = new Set(["accounts", "assignments", "health", "alerts", "audit"]);
  const view = validViews.has(String(query.view || "accounts")) ? String(query.view || "accounts") : "accounts";
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");

  await syncVerifyOperationalAlerts(admin);
  const eventSince = verifyWindowStart(24);
  const [credentialResult, accountResult, slotResult, subscriptionResult, clientResult, eventResult, alertResult, auditResult] = await Promise.all([
    admin.from("uniplug_mailbox_credentials").select("mailbox_email,connected_at,last_checked_at,last_error").order("mailbox_email"),
    admin.from("accounts").select("id,account_mail,service_name,game,profile_name,password_secret_id").order("account_mail").limit(2000),
    admin.from("slots").select("id,account,status,expiry_date").limit(2000),
    admin
      .from("client_subscriptions")
      .select("id,client_id,status,account_reference,verify_enabled,verify_updated_at,metadata,service:client_services!client_subscriptions_service_id_fkey(name,verify_enabled,verify_provider)")
      .order("updated_at", { ascending: false })
      .limit(2000),
    admin.from("clients").select("id,display_name,email,phone").limit(2000),
    admin.from("uniplug_household_events").select("event_type,provider,created_at").gte("created_at", eventSince).limit(5000),
    admin.from("uniplug_verify_alerts").select("id,category,severity,status,provider,mailbox_email,client_subscription_id,safe_context,occurrence_count,last_seen_at").order("last_seen_at", { ascending: false }).limit(200),
    admin.from("uniplug_verify_admin_events").select("id,action,outcome,failure_category,mailbox_email,created_at").order("created_at", { ascending: false }).limit(100)
  ]);
  const loadError = credentialResult.error || accountResult.error || slotResult.error || subscriptionResult.error || clientResult.error || eventResult.error || alertResult.error || auditResult.error;
  if (loadError) throw new Error(`VeriFy operations could not be loaded: ${loadError.message}`);

  const credentials = (credentialResult.data || []) as MailboxCredential[];
  const storedAccounts = ((accountResult.data || []) as ManagedAccount[]).filter((account) => account.account_mail);
  const slots = (slotResult.data || []) as Slot[];
  const allSubscriptions = (subscriptionResult.data || []) as unknown as Subscription[];
  const subscriptions = allSubscriptions.filter((subscription) => related(subscription.service)?.verify_enabled);
  const accountByEmail = new Map(
    storedAccounts.map((account) => [normalized(account.account_mail), account] as const)
  );
  for (const subscription of subscriptions) {
    const email = normalized(subscription.account_reference);
    if (!email || accountByEmail.has(email)) continue;
    accountByEmail.set(email, {
      id: null,
      account_mail: subscription.account_reference?.trim() || email,
      service_name: related(subscription.service)?.name || "Digital service",
      game: null,
      profile_name: null,
      password_secret_id: null
    });
  }
  const accounts = [...accountByEmail.values()];
  const clients = (clientResult.data || []) as Client[];
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const credentialMap = new Map(credentials.map((credential) => [normalized(credential.mailbox_email), credential]));
  const events = (eventResult.data || []) as VerifyEvent[];
  const alerts = (alertResult.data || []) as VerifyAlert[];
  const audits = (auditResult.data || []) as AdminEvent[];
  const activeAlerts = alerts.filter((alert) => alert.status === "open");
  const degraded = credentials.filter((credential) => credential.last_error);
  const successes = events.filter((event) => ["code_found", "code_reused"].includes(event.event_type));
  const noCodes = events.filter((event) => event.event_type === "code_not_found");
  const throttled = events.filter((event) => event.event_type === "rate_limited");
  const completedChecks = successes.length + noCodes.length + events.filter((event) => event.event_type === "mailbox_check_failed").length;
  const successRate = completedChecks ? Math.round((successes.length / completedChecks) * 100) : 0;
  const lastSuccess = successes.map((event) => event.created_at).sort().at(-1) || null;

  const accountRows = accounts.map((account) => {
    const email = normalized(account.account_mail);
    const credential = credentialMap.get(email) || null;
    const accountSubscriptions = allSubscriptions.filter((subscription) => (
      (Boolean(account.id) && assignedAccountId(subscription.metadata) === account.id)
      || normalized(subscription.account_reference) === email
    ));
    const accountSlots = slots.filter((slot) => normalized(slot.account) === email);
    const usedSlots = accountSlots.filter((slot) => accountSubscriptions.some((subscription) => normalized(subscription.account_reference) === normalized(slot.account)));
    const health = credential?.last_error ? "connection_error" : !credential ? "missing_app" : accountSubscriptions.length ? "healthy" : "unassigned";
    return { account, credential, accountSubscriptions, accountSlots, usedSlots, health };
  });

  const missingAppPasswords = accountRows.filter((row) => !row.credential).length;
  const search = normalized(query.search);
  const state = String(query.state || "all");
  const filteredAccounts = accountRows.filter((row) => {
    const clientNames = row.accountSubscriptions.map((subscription) => clientMap.get(subscription.client_id)?.display_name || "").join(" ");
    const haystack = normalized(`${row.account.account_mail} ${row.account.service_name || row.account.game || ""} ${row.account.profile_name || ""} ${clientNames}`);
    const matchesSearch = !search || haystack.includes(search);
    const matchesState = state === "all" || row.health === state;
    return matchesSearch && matchesState;
  });

  const activeHref = view === "accounts" ? "/admin/mailboxes" : `/admin/mailboxes?view=${view}`;

  return (
    <section className="portal-page verify-ops-page">
      <AdminPageHeader
        eyebrow="VeriFy"
        title="Account & verification operations"
        description="Manage service accounts, Gmail app passwords, assignments and provider health from separate focused views."
        actions={<><Link className="button button-light" href="/admin/verify/providers">Provider gates</Link><Link className="button button-dark" href="/tools/verify">Member tool</Link></>}
      />

      {query.success && successMessages[query.success] ? <p className="admin-notice">{successMessages[query.success]}</p> : null}
      {query.error && errorMessages[query.error] ? <p className="admin-notice error">{errorMessages[query.error]}</p> : null}

      <AdminMetricStrip items={[
        { label: "Managed accounts", value: accounts.length, detail: `${missingAppPasswords} missing app password` },
        { label: "Connected mailboxes", value: credentials.length - degraded.length, detail: `${degraded.length} connection issue${degraded.length === 1 ? "" : "s"}`, tone: degraded.length ? "warning" : "good" },
        { label: "Success · 24h", value: `${successRate}%`, detail: `${successes.length} successful checks`, tone: successRate >= 80 ? "good" : successRate ? "warning" : "default" },
        { label: "Open alerts", value: activeAlerts.length, detail: `${noCodes.length} no-code · ${throttled.length} throttled`, tone: activeAlerts.length ? "warning" : "good" }
      ]} />

      <AdminTabs active={activeHref} tabs={[
        { label: "Accounts", href: "/admin/mailboxes", count: accounts.length },
        { label: "Assignments", href: "/admin/mailboxes?view=assignments", count: subscriptions.length },
        { label: "Health", href: "/admin/mailboxes?view=health", count: degraded.length },
        { label: "Alerts", href: "/admin/mailboxes?view=alerts", count: activeAlerts.length },
        { label: "Audit", href: "/admin/mailboxes?view=audit" }
      ]} />

      {view === "accounts" ? (
        <>
          <AdminToolbar>
            <form method="get">
              <input className="admin-search" type="search" name="search" defaultValue={query.search || ""} placeholder="Search account, service, profile or member…" />
              <select name="state" defaultValue={state}>
                <option value="all">All accounts</option>
                <option value="healthy">Healthy</option>
                <option value="missing_app">Missing app password</option>
                <option value="connection_error">Connection error</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <button className="button button-light" type="submit">Filter</button>
            </form>
          </AdminToolbar>

          <AdminSection title="Managed service accounts" description={`${filteredAccounts.length} matching account${filteredAccounts.length === 1 ? "" : "s"}. Password values stay out of the table.`}>
            {filteredAccounts.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Service account</th><th>Login password</th><th>App password</th><th>Slots</th><th>Assignments</th><th>Health</th><th>Manage</th></tr></thead>
                  <tbody>
                    {filteredAccounts.map((row) => {
                      const serviceName = row.account.service_name || row.account.game || "Digital service";
                      const healthLabel = row.health === "missing_app" ? "Missing app password" : row.health === "connection_error" ? "Connection error" : row.health === "unassigned" ? "Unassigned" : "Healthy";
                      return (
                        <tr key={row.account.id || normalized(row.account.account_mail)}>
                          <td><strong>{row.account.account_mail}</strong><small>{serviceName}{row.account.profile_name ? ` · ${row.account.profile_name}` : ""}</small></td>
                          <td><AdminStatus value={row.account.password_secret_id ? "connected" : row.account.id ? "attention" : "linked"} label={row.account.password_secret_id ? "Vault stored" : row.account.id ? "Legacy / update" : "Subscription linked"} /></td>
                          <td><AdminStatus value={row.credential ? row.credential.last_error ? "degraded" : "connected" : "missing"} label={row.credential ? row.credential.last_error ? "Needs attention" : "Connected" : "Missing"} /></td>
                          <td><strong>{row.accountSlots.length}</strong><small>{row.accountSlots.filter((slot) => !["expired", "inactive", "blocked"].includes(normalized(slot.status))).length} operational</small></td>
                          <td><strong>{row.accountSubscriptions.length}</strong><small>{row.accountSubscriptions.slice(0, 2).map((subscription) => clientMap.get(subscription.client_id)?.display_name || related(subscription.service)?.name || "Member").join(" · ") || "No member"}</small></td>
                          <td><AdminStatus value={row.health === "missing_app" ? "missing" : row.health === "connection_error" ? "degraded" : row.health} label={healthLabel} /></td>
                          <td>
                            <AdminDrawer triggerLabel="Manage" triggerClassName="button button-light small" title={row.account.account_mail || "Service account"} eyebrow={serviceName} description="Update account credentials, connect Gmail and see exactly who is assigned.">
                              <div className="admin-stack">
                                {row.account.id ? <div className="admin-compact-card">
                                  <strong>Service account details</strong>
                                  <p>Enter a new login password only when it changes. Existing passwords are never printed here.</p>
                                  <form action={updateVerifyAccountCredentials} className="admin-form-clean" style={{ marginTop: 12 }}>
                                    <input name="accountId" type="hidden" value={row.account.id} />
                                    <label>Account email<input name="accountEmail" type="email" defaultValue={row.account.account_mail || ""} required /></label>
                                    <label>New account password<input name="accountPassword" type="password" autoComplete="new-password" placeholder="Leave blank to keep current password" /></label>
                                    <div className="admin-split-fields">
                                      <label>Profile name<input name="profileName" defaultValue={row.account.profile_name || ""} placeholder="Optional" /></label>
                                      <label>Profile PIN<input name="profilePin" type="password" inputMode="numeric" autoComplete="new-password" placeholder="Leave blank to keep current PIN" /></label>
                                    </div>
                                    <button className="button button-dark small" type="submit">Save account</button>
                                  </form>
                                </div> : <div className="admin-compact-card"><strong>Subscription-tracked mailbox</strong><p>This mailbox comes from an active member subscription. Gmail verification can be managed here even though the legacy account row is absent.</p></div>}

                                <div className="admin-compact-card">
                                  <strong>Gmail app password</strong>
                                  <p>{row.credential ? `Last tested ${formatTime(row.credential.last_checked_at)}${row.credential.last_error ? ` · ${row.credential.last_error}` : ""}` : "No app password is connected. Add one to make this mailbox usable by VeriFy."}</p>
                                  <form action={rotateVerifyMailboxCredential} className="admin-form-clean" style={{ marginTop: 12 }}>
                                    <input name="mailboxEmail" type="hidden" value={row.account.account_mail || ""} />
                                    <label>{row.credential ? "Replace app password" : "Add app password"}<input name="appPassword" type="password" autoComplete="new-password" minLength={16} maxLength={19} required placeholder="16-character Gmail app password" /></label>
                                    <button className="button button-dark small" type="submit">Test & securely save</button>
                                  </form>
                                  {row.credential ? <div className="admin-page-actions" style={{ marginTop: 9, justifyContent: "flex-start" }}><form action={testVerifyMailbox}><input name="mailboxEmail" type="hidden" value={row.credential.mailbox_email} /><button className="button button-light small" type="submit">Safe test</button></form><form action={revokeVerifyMailboxCredential}><input name="mailboxEmail" type="hidden" value={row.credential.mailbox_email} /><ConfirmSubmitButton className="button button-light small" confirmation={`Revoke VeriFy access to ${row.credential.mailbox_email}?`}>Revoke</ConfirmSubmitButton></form></div> : null}
                                </div>

                                <div className="admin-compact-card">
                                  <strong>Assignments</strong>
                                  <p>{row.accountSubscriptions.length ? `${row.accountSubscriptions.length} subscription${row.accountSubscriptions.length === 1 ? "" : "s"} use this account.` : "No member subscription currently uses this account."}</p>
                                  {row.accountSubscriptions.length ? <div className="admin-stack" style={{ marginTop: 10 }}>{row.accountSubscriptions.map((subscription) => { const client = clientMap.get(subscription.client_id); return <div key={subscription.id}><strong style={{ fontSize: 11 }}>{client?.display_name || client?.email || "Member"}</strong><span className="admin-row-subtext">{related(subscription.service)?.name || "Service"} · {readable(subscription.status)}</span></div>; })}</div> : null}
                                </div>
                              </div>
                            </AdminDrawer>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <AdminEmptyState title="No accounts match" description="Clear the filters or choose a different account health state." />}
          </AdminSection>
        </>
      ) : null}

      {view === "assignments" ? (
        <AdminSection title="VeriFy assignments" description="Which member uses which mailbox, plus the subscription-level VeriFy control.">
          {subscriptions.length ? (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Service</th><th>Account</th><th>Subscription</th><th>VeriFy</th><th>Control</th></tr></thead><tbody>{subscriptions.map((subscription) => {
              const client = clientMap.get(subscription.client_id);
              const service = related(subscription.service);
              return <tr key={subscription.id}><td><strong>{client?.display_name || client?.email || "Member"}</strong><small>{client?.phone || client?.email || ""}</small></td><td>{service?.name || "Service"}</td><td><strong>{subscription.account_reference || "Unassigned"}</strong></td><td><AdminStatus value={subscription.status} /></td><td><AdminStatus value={subscription.verify_enabled ? "enabled" : "attention"} label={subscription.verify_enabled ? "Enabled" : "Disabled"} /></td><td><form action={setSubscriptionVerifyEnabled} className="admin-inline-form"><input name="subscriptionId" type="hidden" value={subscription.id} /><input name="enabled" type="hidden" value={subscription.verify_enabled ? "false" : "true"} />{subscription.verify_enabled ? <input name="reason" maxLength={160} required placeholder="Reason to disable" /> : <input name="reason" type="hidden" value="VeriFy restored by administrator" />}<button className={`button ${subscription.verify_enabled ? "button-light" : "button-dark"} small`} type="submit">{subscription.verify_enabled ? "Disable" : "Enable"}</button></form></td></tr>;
            })}</tbody></table></div>
          ) : <AdminEmptyState title="No VeriFy assignments" description="Enable a reviewed provider capability on a service first." />}
        </AdminSection>
      ) : null}

      {view === "health" ? (
        <div className="admin-section-grid">
          <AdminSection title="Provider health" description="Last 24 hours"><div className="admin-attention-list"><div className="admin-attention-row"><div><strong>Successful checks</strong><p>Codes found or safely reused.</p></div><strong>{successes.length}</strong></div><div className="admin-attention-row"><div><strong>No-code results</strong><p>Mailbox checked but no matching code found.</p></div><strong>{noCodes.length}</strong></div><div className="admin-attention-row"><div><strong>Throttled</strong><p>Requests rate limited by policy/provider.</p></div><strong>{throttled.length}</strong></div><div className="admin-attention-row"><div><strong>Last success</strong><p>Most recent successful provider result.</p></div><strong>{formatTime(lastSuccess)}</strong></div></div></AdminSection>
          <AdminSection title="Mailbox health" description="Only connection state, never mailbox content">{credentials.length ? <div className="admin-attention-list">{credentials.map((credential) => <div className="admin-attention-row" key={credential.mailbox_email}><div><strong>{credential.mailbox_email}</strong><p>{credential.last_error || `Last tested ${formatTime(credential.last_checked_at)}`}</p></div><AdminStatus value={credential.last_error ? "degraded" : "connected"} label={credential.last_error ? "Attention" : "Connected"} /></div>)}</div> : <AdminEmptyState title="No mailbox connections" description="Add an app password from the Accounts view." />}</AdminSection>
        </div>
      ) : null}

      {view === "alerts" ? (
        <AdminSection title="Operational alerts" description="Provider outages, authentication failures and unusual activity that need action.">
          {alerts.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Signal</th><th>Provider / account</th><th>Occurrences</th><th>Last seen</th><th>Status</th><th>Action</th></tr></thead><tbody>{alerts.map((alert) => { const failureCategory = String(alert.safe_context.failureCategory || alert.category); const supportHref = `/admin/requests?verifyProvider=${encodeURIComponent(alert.provider)}&verifyCategory=${encodeURIComponent(failureCategory)}`; return <tr key={alert.id}><td><strong>{readable(alert.category)}</strong><small>{readable(failureCategory)}</small></td><td>{alert.mailbox_email || alert.provider}</td><td>{alert.occurrence_count}</td><td>{formatTime(alert.last_seen_at)}</td><td><AdminStatus value={alert.status === "open" ? alert.severity : "resolved"} label={`${alert.severity} · ${alert.status}`} /></td><td><div className="admin-table-actions"><Link className="button button-light small" href={supportHref}>Support</Link><form action={setVerifyAlertStatus}><input name="alertId" type="hidden" value={alert.id} /><button className="button button-dark small" name="status" value={alert.status === "open" ? "resolved" : "open"} type="submit">{alert.status === "open" ? "Resolve" : "Reopen"}</button></form></div></td></tr>; })}</tbody></table></div> : <AdminEmptyState title="No operational alerts" description="VeriFy has no current authentication, provider or activity signals." />}
        </AdminSection>
      ) : null}

      {view === "audit" ? (
        <AdminSection title="Administrator audit" description="Recent VeriFy and credential-management actions.">
          {audits.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Action</th><th>Account / category</th><th>Outcome</th><th>Time</th></tr></thead><tbody>{audits.map((event) => <tr key={event.id}><td><strong>{readable(event.action)}</strong></td><td>{event.mailbox_email || event.failure_category || "VeriFy operations"}</td><td><AdminStatus value={event.outcome === "success" ? "completed" : event.outcome} label={readable(event.outcome)} /></td><td>{formatTime(event.created_at)}</td></tr>)}</tbody></table></div> : <AdminEmptyState title="No audit events" description="Administrator actions will appear here." />}
        </AdminSection>
      ) : null}
    </section>
  );
}
