import { resolveReplacementApproval, resolveSubscriptionRequest, updateSupportTicket } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscription requests" };

export default async function AdminRequestsPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; verifyProvider?: string; verifyCategory?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [requestResult, ticketResult, replacementResult] = supabase
    ? await Promise.all([
      supabase
        .from("uniplug_subscription_requests")
        .select("id,request_type,reason,status,admin_note,resolved_at,created_at,profile:uniplug_profiles(display_name,username,email),subscription:uniplug_member_subscriptions(status,service:uniplug_catalog_services(name))")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("uniplug_support_tickets").select("id,user_id,subject,message,status,admin_note,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("uniplug_replacement_approvals").select("id,user_id,service_name,reason,status,admin_note,reviewed_at,created_at").order("created_at", { ascending: false }).limit(100)
    ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const requests = (requestResult.data || []) as unknown as Array<{
    id: string;
    request_type: "pause" | "cancel";
    reason: string | null;
    status: string;
    admin_note: string | null;
    resolved_at: string | null;
    created_at: string;
    profile: { display_name: string | null; username: string; email: string } | null;
    subscription: { status: string; service: { name: string } | null } | null;
  }>;
  const tickets = (ticketResult.data || []) as Array<{ id: string; user_id: string; subject: string; message: string; status: string; admin_note: string | null; created_at: string }>;
  const replacements = (replacementResult.data || []) as Array<{ id: string; user_id: string; service_name: string; reason: string; status: string; admin_note: string | null; reviewed_at: string | null; created_at: string }>;
  const pendingReplacements = replacements.filter((request) => request.status === "pending");
  const openTickets = tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status));
  const pending = requests.filter((request) => request.status === "pending");
  const resolved = requests.filter((request) => request.status !== "pending");

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">Member care</p><h1>Tickets & subscription requests</h1><p>Review support tickets, pause requests, and cancellations from one queue.</p></div>
      </div>
      {query.success ? <p className="form-success page-notice">Subscription request updated.</p> : null}
      {query.verifyProvider ? <p className="form-success page-notice">VeriFy support context: provider <strong>{query.verifyProvider}</strong> · safe category <strong>{(query.verifyCategory || "configuration_missing").replaceAll("_", " ")}</strong>. Never request a password or verification code from the member.</p> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>Open tickets</span><strong>{openTickets.length}</strong><small>Needs a response</small></article>
        <article><span>Pending</span><strong>{pending.length + pendingReplacements.length}</strong><small>Needs review</small></article>
        <article><span>Completed</span><strong>{requests.filter((request) => request.status === "completed").length}</strong><small>Action fulfilled</small></article>
        <article><span>Declined</span><strong>{requests.filter((request) => request.status === "declined").length}</strong><small>Decision recorded</small></article>
      </div>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Support queue</p><h2>Member tickets</h2></div></div>
        <div className="request-admin-list">
          {tickets.map((ticket) => (
            <article key={ticket.id}>
              <div className="request-admin-main"><span className="status-pill">{ticket.status.replace("_", " ")}</span><strong>{ticket.subject}</strong><span>Member {ticket.user_id.slice(0, 8)}</span><small>{new Date(ticket.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small><p>{ticket.message}</p></div>
              <form action={updateSupportTicket} className="request-resolution-form">
                <input name="ticketId" type="hidden" value={ticket.id} />
                <input name="adminNote" defaultValue={ticket.admin_note || ""} placeholder="Reply visible to the member" maxLength={2000} required />
                <button className="button button-light small" name="status" value="in_progress" type="submit">In progress</button>
                <button className="button button-dark small" name="status" value="resolved" type="submit">Resolve</button>
              </form>
            </article>
          ))}
          {!tickets.length ? <div className="empty-state"><h3>No support tickets</h3><p>New member tickets will appear here.</p></div> : null}
        </div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Replacement approvals</p><h2>Account replacement requests</h2><p>Every account replacement requires an administrator decision before credentials can change.</p></div><span className="status-pill subtle">{pendingReplacements.length} pending</span></div>
        <div className="request-admin-list">
          {pendingReplacements.map((request) => (
            <article key={request.id}>
              <div className="request-admin-main"><span className="status-pill">Approval needed</span><strong>{request.service_name}</strong><span>Member {request.user_id.slice(0, 8)}</span><small>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small><p>{request.reason.replaceAll("_", " ")}</p></div>
              <form action={resolveReplacementApproval} className="request-resolution-form">
                <input name="requestId" type="hidden" value={request.id} />
                <input name="adminNote" placeholder="Decision note (optional)" maxLength={1000} />
                <ConfirmSubmitButton className="button button-light small" confirmation="Decline this account replacement?" name="resolution" value="declined">Decline</ConfirmSubmitButton>
                <ConfirmSubmitButton className="button button-dark small" confirmation="Approve one account replacement for this member?" name="resolution" value="approved">Approve once</ConfirmSubmitButton>
              </form>
            </article>
          ))}
          {!pendingReplacements.length ? <div className="empty-state"><h3>No replacement approvals</h3><p>Additional replacement requests will appear here.</p></div> : null}
        </div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Priority queue</p><h2>Pending requests</h2></div></div>
        <div className="request-admin-list">
          {pending.map((request) => (
            <article key={request.id}>
              <div className="request-admin-main">
                <span className="status-pill">{request.request_type === "pause" ? "Pause" : "Cancellation"}</span>
                <strong>{request.subscription?.service?.name || "Digital service"}</strong>
                <span>{request.profile?.display_name || `@${request.profile?.username || "member"}`} · {request.profile?.email || "No email"}</span>
                <small>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small>
                <p>{request.reason || "No reason supplied."}</p>
              </div>
              <form action={resolveSubscriptionRequest} className="request-resolution-form">
                <input name="requestId" type="hidden" value={request.id} />
                <label className="sr-only" htmlFor={`decision-note-${request.id}`}>
                  Decision note for the member
                </label>
                <input
                  id={`decision-note-${request.id}`}
                  name="adminNote"
                  placeholder="Decision note for the member"
                  maxLength={1000}
                />
                <ConfirmSubmitButton
                  className="button button-light small"
                  confirmation={`Decline this ${request.request_type} request? The member will see the decision note.`}
                  name="resolution"
                  value="declined"
                >
                  Decline
                </ConfirmSubmitButton>
                <ConfirmSubmitButton
                  className="button button-dark small"
                  confirmation={`Mark this ${request.request_type} request as complete? This records the decision immediately.`}
                  name="resolution"
                  value="completed"
                >
                  Complete
                </ConfirmSubmitButton>
              </form>
            </article>
          ))}
          {!pending.length ? <div className="empty-state"><h3>Queue cleared</h3><p>There are no pending subscription requests.</p></div> : null}
        </div>
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Decision history</p><h2>Recently resolved</h2></div></div>
        <div className="admin-list">
          {resolved.slice(0, 30).map((request) => (
            <div key={request.id}>
              <div><strong>{request.subscription?.service?.name || "Service"} · {request.request_type}</strong><span>@{request.profile?.username || "member"} · {request.admin_note || "No admin note"}</span></div>
              <span className={`status-pill status-${request.status}`}>{request.status}</span>
            </div>
          ))}
          {!resolved.length ? <p className="muted-copy">No resolved requests yet.</p> : null}
        </div>
      </section>
    </section>
  );
}

