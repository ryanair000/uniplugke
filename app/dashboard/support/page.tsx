import { createSupportTicket } from "@/app/help/actions";
import { requireMember } from "@/lib/auth";
import { formatMemberDateTime, memberStatusLabel } from "@/lib/member-dashboard";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireMember();
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const ticketsResult = supabase ? await supabase.from("uniplug_support_tickets").select("id,subject,message,status,admin_note,created_at,updated_at").eq("user_id", viewer.user.id).order("created_at", { ascending: false }).limit(50) : null;
  const tickets = ticketsResult?.data || [];
  const ticketsUnavailable = !supabase || Boolean(ticketsResult?.error);
  const service = (query.service || "").slice(0, 80);
  const renewal = query.topic === "renewal";
  const verify = query.topic === "verify";
  const provider = query.provider === "netflix" ? "Netflix" : "VeriFy";
  const allowedVerifyCategories = new Set([
    "assignment_missing",
    "configuration_missing",
    "mailbox_connection_missing",
    "mailbox_authentication_failed",
    "mailbox_provider_error",
    "no_current_code",
    "recent_auth_required"
  ]);
  const verifyCategory = allowedVerifyCategories.has(query.category || "") ? query.category! : "configuration_missing";
  const defaultSubject = renewal && service
    ? `Renew ${service}`
    : verify
      ? `${service || provider} VeriFy help`
      : service
        ? `${service} support`
        : "";
  const defaultMessage = renewal && service
    ? `I would like to renew my ${service} service. Please share the next payment step.`
    : verify
      ? `I need help with ${service || provider} VeriFy. Safe failure category: ${verifyCategory}. I have not included any password or verification code.`
      : "";

  return (
    <section className="wallet-page">
      <header className="wallet-page-header wallet-page-header-compact"><div><p className="wallet-kicker">Ticket support</p><h1>How can we help?</h1><p>Create a ticket and keep every update securely attached to your account.</p></div><span className="wallet-support-hours">Tickets only · Account protected</span></header>
      {query.success === "ticket_created" ? <p className="form-success wallet-notice">Your ticket was created. We’ll respond here.</p> : null}
      {query.error ? <p className="form-error wallet-notice">The ticket could not be created. Check the details and try again.</p> : null}
      {ticketsUnavailable ? <p className="form-error wallet-notice">Ticket history could not be loaded. You can still create a new support request below.</p> : null}
      <div className="wallet-support-grid">
        <section className="wallet-card"><div className="wallet-card-heading"><div><p className="wallet-kicker">New request</p><h2>Create a ticket</h2></div><span className="wallet-support-icon" aria-hidden="true">?</span></div><form action={createSupportTicket} className="wallet-ticket-form"><input type="hidden" name="returnTo" value="/dashboard/support"/><label>Subject<input name="subject" minLength={3} maxLength={120} required defaultValue={defaultSubject} placeholder="Briefly describe the issue"/></label><label>Message<textarea name="message" minLength={10} maxLength={2000} required rows={7} defaultValue={defaultMessage} placeholder="Tell us what happened and what you already tried."/></label><p>Never include passwords, verification codes, or payment credentials.</p><button className="button wallet-primary-button" type="submit">Create ticket</button></form></section>
        <section className="wallet-card"><div className="wallet-card-heading"><div><p className="wallet-kicker">Your requests</p><h2>Ticket history</h2></div><span className="wallet-count-badge">{ticketsUnavailable ? "—" : tickets.length}</span></div>{ticketsUnavailable ? <div className="wallet-empty compact"><span aria-hidden="true">!</span><h3>History unavailable</h3><p>Refresh the page to try loading your previous requests again.</p></div> : <div className="wallet-ticket-list">{tickets.map((ticket) => <article key={ticket.id}><div><strong>{ticket.subject}</strong><span className={`wallet-status status-${ticket.status}`}><i/>{memberStatusLabel(String(ticket.status))}</span></div><small>{formatMemberDateTime(ticket.created_at)}</small><p>{ticket.message}</p>{ticket.admin_note ? <div className="wallet-ticket-reply"><b>UniPlug reply</b><p>{ticket.admin_note}</p></div> : null}</article>)}{!tickets.length ? <div className="wallet-empty compact"><span aria-hidden="true">◇</span><h3>No tickets yet</h3><p>Your requests and replies will appear here.</p></div> : null}</div>}</section>
      </div>
    </section>
  );
}
