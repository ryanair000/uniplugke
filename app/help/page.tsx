import type { Metadata } from "next";
import { createSupportTicket } from "@/app/help/actions";
import { HelpFaq } from "@/components/help-faq";
import { PublicPageIntro } from "@/components/public-page";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Support Tickets",
  description: "Create and track support tickets for your UniPlug account."
};

const faqs = [
  { question: "Which currency does UniPlug show?", answer: "Visitors see public starting prices in US dollars. Signed-in members see authoritative plan prices in Kenyan shillings." },
  { question: "Where can I follow an order?", answer: "Open My UniPlug and choose Orders to see payment, fulfillment, and reference details." },
  { question: "How do I request support?", answer: "Create a ticket below. Include the service or order reference and describe the issue. Support is handled only through tickets." },
  { question: "What should I never include?", answer: "Never submit passwords, one-time codes, or complete card or mobile-money credentials in a ticket." }
];

export default async function HelpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireMember();
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase.from("uniplug_support_tickets").select("id,subject,message,status,admin_note,created_at,updated_at").eq("user_id", viewer.user.id).order("created_at", { ascending: false }).limit(50)
    : { data: [] };
  const tickets = data || [];

  return (
    <div className="public-page">
      <PublicPageIntro eyebrow="Support tickets" title="Create and track a ticket." description="Ticketing is the only UniPlug support channel. Your requests and replies stay attached to your member account." />
      <div className="public-page-shell public-page-content">
        {query.success === "ticket_created" ? <p className="form-success">Your support ticket was created.</p> : null}
        {query.error ? <p className="form-error">The ticket could not be created. Check the subject and message, then try again.</p> : null}

        <section className="panel" aria-labelledby="new-ticket-title">
          <div className="section-heading compact"><div><p className="eyebrow">New request</p><h2 id="new-ticket-title">Create support ticket</h2></div></div>
          <form action={createSupportTicket} className="stack-form">
            <label className="field">Subject<input name="subject" minLength={3} maxLength={120} required placeholder="Briefly describe the issue" /></label>
            <label className="field">Message<textarea name="message" minLength={10} maxLength={2000} required rows={7} placeholder="Include the service or order reference and what happened. Never include passwords or one-time codes." /></label>
            <button className="button button-dark" type="submit">Create ticket</button>
          </form>
        </section>

        <section className="panel" aria-labelledby="ticket-history-title">
          <div className="section-heading compact"><div><p className="eyebrow">Your requests</p><h2 id="ticket-history-title">Ticket history</h2></div><span className="status-pill subtle">{tickets.length}</span></div>
          <div className="request-history">
            {tickets.map((ticket) => (
              <article key={ticket.id}>
                <div><strong>{ticket.subject}</strong><span>{new Date(ticket.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                <span className="status-pill">{ticket.status.replace("_", " ")}</span>
                <p>{ticket.message}</p>
                {ticket.admin_note ? <p><b>UniPlug:</b> {ticket.admin_note}</p> : null}
              </article>
            ))}
            {!tickets.length ? <div className="empty-state"><h3>No tickets yet</h3><p>Your support tickets will appear here after you create one.</p></div> : null}
          </div>
        </section>

        <HelpFaq items={faqs} />
      </div>
    </div>
  );
}
