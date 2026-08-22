import Link from "next/link";
import { notFound } from "next/navigation";
import { replySupportTicket } from "@/app/help/actions";
import styles from "@/components/support-ui.module.css";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support request" };

type Ticket = {
  id: string;
  public_id: string;
  subject: string;
  status: string;
  category: string;
  service_name: string | null;
  subscription_id: string | null;
  order_id: string | null;
  order_number: string | null;
  created_at: string;
};

type Message = {
  id: string;
  sender_role: "member" | "admin";
  body: string;
  created_at: string;
};

type Attachment = {
  id: string;
  message_id: string | null;
  storage_path: string;
  file_name: string;
};

function statusLabel(status: string) {
  if (status === "in_progress") return "In progress";
  if (status === "waiting_customer") return "Waiting for you";
  if (status === "resolved" || status === "closed") return "Resolved";
  return "Open";
}

function statusClass(status: string) {
  if (status === "in_progress") return styles.statusProgress;
  if (status === "waiting_customer") return styles.statusWaiting;
  if (status === "resolved" || status === "closed") return styles.statusResolved;
  return styles.statusOpen;
}

function replyError(code: string | undefined) {
  if (code === "rate_limited") return "You are sending replies too quickly. Try again in a moment.";
  if (code === "invalid_attachment") return "That screenshot was rejected. Use a real JPG, PNG, or WEBP image up to 5 MB.";
  if (code) return "That reply could not be sent. Please try again.";
  return null;
}

export default async function SupportTicketPage({
  params,
  searchParams
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const viewer = await requireMember();
  const { ticketId } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const { data: ticketData } = await supabase
    .from("uniplug_support_tickets")
    .select("id,public_id,subject,status,category,service_name,subscription_id,order_id,order_number,created_at")
    .eq("id", ticketId)
    .eq("user_id", viewer.user.id)
    .maybeSingle();
  if (!ticketData) notFound();
  const ticket = ticketData as Ticket;

  await supabase.rpc("uniplug_mark_support_ticket_read", { p_ticket_id: ticket.id });

  const [{ data: messageData }, { data: attachmentData }] = await Promise.all([
    supabase
      .from("uniplug_support_messages")
      .select("id,sender_role,body,created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("uniplug_support_attachments")
      .select("id,message_id,storage_path,file_name")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true })
  ]);

  const messages = (messageData || []) as Message[];
  const attachments = (attachmentData || []) as Attachment[];
  const signedAttachments = await Promise.all(attachments.map(async (attachment) => {
    const { data } = await supabase.storage.from("uniplug-support").createSignedUrl(attachment.storage_path, 300);
    return { ...attachment, url: data?.signedUrl || null };
  }));
  const attachmentMap = new Map<string, typeof signedAttachments>();
  for (const attachment of signedAttachments) {
    if (!attachment.message_id) continue;
    const current = attachmentMap.get(attachment.message_id) || [];
    current.push(attachment);
    attachmentMap.set(attachment.message_id, current);
  }
  const errorMessage = replyError(query.error);

  return (
    <section className={`${styles.page} ${styles.threadShell}`}>
      <Link className={styles.backLink} href="/dashboard/support">← Back to Support</Link>

      <header className={styles.threadHeader}>
        <div>
          <p className={styles.kicker}>Support request</p>
          <h1>{ticket.subject}</h1>
          <div className={styles.threadMeta}>
            <span>{ticket.public_id}</span>
            {ticket.service_name ? <span>{ticket.service_name}</span> : null}
            {ticket.order_number ? <span>Order {ticket.order_number}</span> : null}
            <span>{ticket.category.replaceAll("_", " ")}</span>
            <span>Opened {new Date(ticket.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
          </div>
        </div>
        <span className={`${styles.status} ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
      </header>

      {query.success === "ticket_created" ? <p className={styles.notice}>Request sent. UniPlug Support will reply here.</p> : null}
      {query.success === "reply_sent" ? <p className={styles.notice}>Your reply was sent.</p> : null}
      {query.warning === "attachment_failed" ? <p className={`${styles.notice} ${styles.noticeError}`}>Your message was sent, but the screenshot could not be attached.</p> : null}
      {errorMessage ? <p className={`${styles.notice} ${styles.noticeError}`}>{errorMessage}</p> : null}

      <section className={styles.conversation} aria-label="Support conversation">
        {messages.map((message) => {
          const messageAttachments = attachmentMap.get(message.id) || [];
          return (
            <article className={`${styles.message} ${message.sender_role === "member" ? styles.messageMember : styles.messageAdmin}`} key={message.id}>
              <div className={styles.messageHead}>
                <strong>{message.sender_role === "member" ? "You" : "UniPlug Support"}</strong>
                <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <p>{message.body}</p>
              {messageAttachments.length ? (
                <div className={styles.attachments}>
                  {messageAttachments.map((attachment) => attachment.url ? (
                    <a className={styles.attachment} href={attachment.url} key={attachment.id} target="_blank" rel="noreferrer">📎 {attachment.file_name}</a>
                  ) : null)}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className={styles.replyCard}>
        <form action={replySupportTicket} className={styles.form} encType="multipart/form-data">
          <input name="ticketId" type="hidden" value={ticket.id} />
          <label>
            Reply
            <textarea name="message" maxLength={4000} required rows={4} placeholder={ticket.status === "resolved" || ticket.status === "closed" ? "Replying will reopen this request." : "Write a reply to UniPlug Support..."} />
          </label>
          <div className={styles.replyActions}>
            <label>
              Screenshot <span className={styles.fileHint}>Optional · max 5 MB</span>
              <input name="attachment" type="file" accept="image/jpeg,image/png,image/webp" />
            </label>
            <button className={styles.primary} type="submit">Send reply</button>
          </div>
          <p className={styles.securityNote}><b>Reminder:</b> Never send passwords, OTPs, verification codes, or payment credentials.</p>
        </form>
      </section>
    </section>
  );
}
