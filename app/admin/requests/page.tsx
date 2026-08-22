import { resolveReplacementApproval, resolveSubscriptionRequest, updateSupportTicket } from "@/app/admin/actions";
import { AdminDrawer } from "@/components/admin-drawer";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminTabs, AdminToolbar } from "@/components/admin-console";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member requests" };

export default async function AdminRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; verifyProvider?: string; verifyCategory?: string; view?: string; search?: string }>;
}) {
  const query = await searchParams;
  const allowedViews = new Set(["support", "replacements", "subscriptions", "history"]);
  const view = allowedViews.has(String(query.view || "support")) ? String(query.view || "support") : "support";
  const search = String(query.search || "").trim().toLowerCase();
  const supabase = await createServerSupabaseClient();
  const [requestResult, ticketResult, replacementResult, profileResult] = supabase
    ? await Promise.all([
      supabase.from("uniplug_subscription_requests").select("id,request_type,reason,status,admin_note,resolved_at,created_at,profile:uniplug_profiles(display_name,username,email),subscription:uniplug_member_subscriptions(status,service:uniplug_catalog_services(name))").order("created_at", { ascending: false }).limit(200),
      supabase.from("uniplug_support_tickets").select("id,user_id,subject,message,status,admin_note,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("uniplug_replacement_approvals").select("id,user_id,service_name,reason,status,admin_note,reviewed_at,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("uniplug_profiles").select("user_id,display_name,username,email").limit(1000)
    ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const requests = (requestResult.data || []) as unknown as Array<{ id: string; request_type: "pause" | "cancel"; reason: string | null; status: string; admin_note: string | null; resolved_at: string | null; created_at: string; profile: { display_name: string | null; username: string; email: string } | null; subscription: { status: string; service: { name: string } | null } | null }>;
  const tickets = (ticketResult.data || []) as Array<{ id: string; user_id: string; subject: string; message: string; status: string; admin_note: string | null; created_at: string }>;
  const replacements = (replacementResult.data || []) as Array<{ id: string; user_id: string; service_name: string; reason: string; status: string; admin_note: string | null; reviewed_at: string | null; created_at: string }>;
  const profiles = (profileResult.data || []) as Array<{ user_id: string; display_name: string | null; username: string; email: string }>;
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const pendingReplacements = replacements.filter((request) => request.status === "pending");
  const openTickets = tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status));
  const pending = requests.filter((request) => request.status === "pending");
  const history = [
    ...requests.filter((request) => request.status !== "pending").map((request) => ({ id: request.id, kind: "Subscription", subject: `${request.subscription?.service?.name || "Service"} · ${request.request_type}`, member: request.profile?.display_name || `@${request.profile?.username || "member"}`, status: request.status, note: request.admin_note, at: request.resolved_at || request.created_at })),
    ...replacements.filter((request) => request.status !== "pending").map((request) => { const profile = profileMap.get(request.user_id); return { id: request.id, kind: "Replacement", subject: request.service_name, member: profile?.display_name || profile?.email || `Member ${request.user_id.slice(0, 8)}`, status: request.status, note: request.admin_note, at: request.reviewed_at || request.created_at }; }),
    ...tickets.filter((ticket) => !["open", "in_progress"].includes(ticket.status)).map((ticket) => { const profile = profileMap.get(ticket.user_id); return { id: ticket.id, kind: "Support", subject: ticket.subject, member: profile?.display_name || profile?.email || `Member ${ticket.user_id.slice(0, 8)}`, status: ticket.status, note: ticket.admin_note, at: ticket.created_at }; })
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const filteredTickets = openTickets.filter((ticket) => { const profile = profileMap.get(ticket.user_id); return !search || `${ticket.subject} ${ticket.message} ${profile?.display_name || ""} ${profile?.email || ""}`.toLowerCase().includes(search); });
  const filteredReplacements = pendingReplacements.filter((request) => { const profile = profileMap.get(request.user_id); return !search || `${request.service_name} ${request.reason} ${profile?.display_name || ""} ${profile?.email || ""}`.toLowerCase().includes(search); });
  const filteredPending = pending.filter((request) => !search || `${request.request_type} ${request.reason || ""} ${request.profile?.display_name || ""} ${request.profile?.email || ""} ${request.subscription?.service?.name || ""}`.toLowerCase().includes(search));
  const filteredHistory = history.filter((item) => !search || `${item.kind} ${item.subject} ${item.member} ${item.status} ${item.note || ""}`.toLowerCase().includes(search));
  const activeHref = view === "support" ? "/admin/requests" : `/admin/requests?view=${view}`;

  return (
    <section className="portal-page">
      <AdminPageHeader eyebrow="Requests" title="Member care queue" description="Support, replacements and subscription decisions are separate views instead of four large panels stacked on one page." />
      {query.success ? <p className="admin-notice">Request updated.</p> : null}
      {query.verifyProvider ? <p className="admin-notice">VeriFy context: <strong>{query.verifyProvider}</strong> · {(query.verifyCategory || "configuration_missing").replaceAll("_", " ")}. Never request a password or verification code from the member.</p> : null}

      <AdminMetricStrip items={[
        { label: "Open support", value: openTickets.length, detail: "needs response", tone: openTickets.length ? "warning" : "good" },
        { label: "Replacements", value: pendingReplacements.length, detail: "needs approval", tone: pendingReplacements.length ? "warning" : "good" },
        { label: "Pause / cancel", value: pending.length, detail: "needs decision", tone: pending.length ? "warning" : "good" },
        { label: "History", value: history.length, detail: "recent decisions" }
      ]} />

      <AdminTabs active={activeHref} tabs={[
        { label: "Support", href: "/admin/requests", count: openTickets.length },
        { label: "Replacements", href: "/admin/requests?view=replacements", count: pendingReplacements.length },
        { label: "Pause & cancel", href: "/admin/requests?view=subscriptions", count: pending.length },
        { label: "History", href: "/admin/requests?view=history", count: history.length }
      ]} />

      <AdminToolbar><form method="get">{view !== "support" ? <input type="hidden" name="view" value={view} /> : null}<input className="admin-search" name="search" type="search" defaultValue={query.search || ""} placeholder="Search member, service or request…" /><button className="button button-light" type="submit">Search</button></form></AdminToolbar>

      {view === "support" ? (
        <AdminSection title="Open support tickets" description={`${filteredTickets.length} ticket${filteredTickets.length === 1 ? "" : "s"} in this view`}>
          {filteredTickets.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Ticket</th><th>Member</th><th>Opened</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filteredTickets.map((ticket) => { const profile = profileMap.get(ticket.user_id); return <tr key={ticket.id}><td><strong>{ticket.subject}</strong><small>{ticket.message.length > 110 ? `${ticket.message.slice(0, 110)}…` : ticket.message}</small></td><td><strong>{profile?.display_name || `@${profile?.username || "member"}`}</strong><small>{profile?.email || ticket.user_id.slice(0, 8)}</small></td><td>{new Date(ticket.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td><td><AdminStatus value={ticket.status} /></td><td><AdminDrawer triggerLabel="Open" triggerClassName="button button-light small" title={ticket.subject} eyebrow="Support ticket" description={`${profile?.display_name || profile?.email || "Member"} · ${new Date(ticket.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`}><div className="admin-stack"><div className="admin-compact-card"><strong>Member message</strong><p style={{ whiteSpace: "pre-wrap" }}>{ticket.message}</p></div><form action={updateSupportTicket} className="admin-form-clean"><input name="ticketId" type="hidden" value={ticket.id} /><label>Reply / admin note<textarea name="adminNote" defaultValue={ticket.admin_note || ""} placeholder="Reply visible to the member" maxLength={2000} required /></label><div className="admin-page-actions" style={{ justifyContent: "flex-start" }}><button className="button button-light small" name="status" value="in_progress" type="submit">Mark in progress</button><button className="button button-dark small" name="status" value="resolved" type="submit">Resolve</button></div></form></div></AdminDrawer></td></tr>; })}</tbody></table></div> : <AdminEmptyState title="Support queue cleared" description="There are no open member tickets matching this search." />}
        </AdminSection>
      ) : null}

      {view === "replacements" ? (
        <AdminSection title="Account replacement approvals" description="Approve the request here; operational slot selection stays visible in the Slots tab.">
          {filteredReplacements.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Service</th><th>Reason</th><th>Requested</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filteredReplacements.map((request) => { const profile = profileMap.get(request.user_id); return <tr key={request.id}><td><strong>{profile?.display_name || `@${profile?.username || "member"}`}</strong><small>{profile?.email || request.user_id.slice(0, 8)}</small></td><td><strong>{request.service_name}</strong></td><td>{request.reason.replaceAll("_", " ")}</td><td>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td><td><AdminStatus value="pending" /></td><td><AdminDrawer triggerLabel="Review" triggerClassName="button button-light small" title={`${request.service_name} replacement`} eyebrow="Approval" description={profile?.display_name || profile?.email || `Member ${request.user_id.slice(0, 8)}`}><div className="admin-stack"><div className="admin-compact-card"><strong>Reason</strong><p>{request.reason.replaceAll("_", " ")}</p></div><form action={resolveReplacementApproval} className="admin-form-clean"><input name="requestId" type="hidden" value={request.id} /><label>Decision note<textarea name="adminNote" placeholder="Optional internal/member decision note" maxLength={1000} /></label><div className="admin-page-actions" style={{ justifyContent: "flex-start" }}><ConfirmSubmitButton className="button button-light small" confirmation="Decline this account replacement?" name="resolution" value="declined">Decline</ConfirmSubmitButton><ConfirmSubmitButton className="button button-dark small" confirmation="Approve one account replacement for this member?" name="resolution" value="approved">Approve once</ConfirmSubmitButton></div></form></div></AdminDrawer></td></tr>; })}</tbody></table></div> : <AdminEmptyState title="No replacement approvals" description="The replacement queue is clear." />}
        </AdminSection>
      ) : null}

      {view === "subscriptions" ? (
        <AdminSection title="Pause & cancellation requests" description="Make the decision without showing a form on every row.">
          {filteredPending.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Service</th><th>Request</th><th>Reason</th><th>Requested</th><th>Manage</th></tr></thead><tbody>{filteredPending.map((request) => <tr key={request.id}><td><strong>{request.profile?.display_name || `@${request.profile?.username || "member"}`}</strong><small>{request.profile?.email || "No email"}</small></td><td>{request.subscription?.service?.name || "Digital service"}</td><td><AdminStatus value="pending" label={request.request_type === "pause" ? "Pause" : "Cancellation"} /></td><td>{request.reason || "No reason supplied"}</td><td>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td><td><AdminDrawer triggerLabel="Review" triggerClassName="button button-light small" title={`${request.request_type === "pause" ? "Pause" : "Cancellation"} request`} eyebrow={request.subscription?.service?.name || "Subscription"} description={request.profile?.display_name || `@${request.profile?.username || "member"}`}><div className="admin-stack"><div className="admin-compact-card"><strong>Member reason</strong><p>{request.reason || "No reason supplied."}</p></div><form action={resolveSubscriptionRequest} className="admin-form-clean"><input name="requestId" type="hidden" value={request.id} /><label>Decision note<textarea name="adminNote" placeholder="Decision note for the member" maxLength={1000} /></label><div className="admin-page-actions" style={{ justifyContent: "flex-start" }}><ConfirmSubmitButton className="button button-light small" confirmation={`Decline this ${request.request_type} request?`} name="resolution" value="declined">Decline</ConfirmSubmitButton><ConfirmSubmitButton className="button button-dark small" confirmation={`Mark this ${request.request_type} request as complete?`} name="resolution" value="completed">Complete</ConfirmSubmitButton></div></form></div></AdminDrawer></td></tr>)}</tbody></table></div> : <AdminEmptyState title="Queue cleared" description="There are no pending pause or cancellation requests." />}
        </AdminSection>
      ) : null}

      {view === "history" ? (
        <AdminSection title="Decision history" description="Resolved support, subscription and replacement items in one compact view.">
          {filteredHistory.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Type</th><th>Request</th><th>Member</th><th>Note</th><th>Status</th><th>Time</th></tr></thead><tbody>{filteredHistory.slice(0, 100).map((item) => <tr key={`${item.kind}-${item.id}`}><td>{item.kind}</td><td><strong>{item.subject}</strong></td><td>{item.member}</td><td>{item.note || "No admin note"}</td><td><AdminStatus value={item.status} /></td><td>{new Date(item.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}</tbody></table></div> : <AdminEmptyState title="No history matches" description="Clear the search to see recent decisions." />}
        </AdminSection>
      ) : null}
    </section>
  );
}
