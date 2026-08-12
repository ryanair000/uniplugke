import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Netflix mailboxes" };

export default async function AdminMailboxesPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const [{ data: accounts }, { data: connections }] = supabase ? await Promise.all([
    supabase.from("accounts").select("id,account_mail,profile_name,service_name,game,updated_at").or("service_name.ilike.%netflix%,game.ilike.%netflix%").order("updated_at", { ascending: false }),
    supabase.from("uniplug_mailbox_credentials").select("mailbox_email,connected_at,last_checked_at,last_error")
  ]) : [{ data: [] }, { data: [] }];
  const connectionMap = new Map((connections || []).map((item) => [item.mailbox_email.toLowerCase(), item]));
  const accountEmails = new Set((accounts || []).map((item) => item.account_mail.toLowerCase()));
  const unassignedConnections = (connections || []).filter((item) => !accountEmails.has(item.mailbox_email.toLowerCase()));

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading"><div><p className="eyebrow">Netflix operations</p><h1>Household mailboxes</h1><p>Gmail app passwords are encrypted at rest and available only to the secure Netflix code route.</p></div></div>
      <p className="form-success page-notice">Mailbox access is server-side only. Members never receive Gmail credentials.</p>
      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Managed accounts</p><h2>Netflix Gmail connections</h2></div><span className="status-pill subtle">{connections?.length || 0} connected</span></div>
        <div className="mailbox-account-list">
          {(accounts || []).map((account) => {
            const connection = connectionMap.get(account.account_mail.toLowerCase());
            return <article key={account.id}><div><strong>{account.account_mail}</strong><span>{account.profile_name || "No profile assigned"}</span>{connection?.last_error ? <small>{connection.last_error}</small> : null}</div><span className={`wallet-status ${connection ? "status-active" : "status-pending"}`}><i/>{connection ? "App password connected" : "Not connected"}</span><div className="mailbox-actions"><span>{connection ? `Connected ${new Date(connection.connected_at).toLocaleDateString("en-KE")}` : "Add an encrypted mailbox credential to enable codes"}</span></div></article>;
          })}
          {unassignedConnections.map((connection) => <article key={connection.mailbox_email}><div><strong>{connection.mailbox_email}</strong><span>Connected mailbox · not yet assigned to Netflix inventory</span></div><span className="wallet-status status-active"><i/>App password connected</span><div className="mailbox-actions"><span>Ready when a matching Netflix account is added</span></div></article>)}
          {!accounts?.length ? <div className="empty-state"><h3>No Netflix accounts found</h3><p>Add a Netflix credential account before connecting Gmail.</p></div> : null}
        </div>
      </section>
    </section>
  );
}
