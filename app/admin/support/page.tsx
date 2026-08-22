import Link from "next/link";
import { replyToSupportTicket } from "@/app/admin/support/actions";
import styles from "@/components/support-ui.module.css";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support inbox" };

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  category: string;
  service_name: string | null;
  order_id: string | null;
  order_number: string | null;
  last_message_at: string | null;
  admin_unread: boolean;
  created_at: string;
};

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string;
  email: string;
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

const filterOptions = [
  ["all", "All"],
  ["open", "New"],
  ["in_progress", "In progress"],
  ["waiting_customer", "Waiting"],
  ["resolved", "Resolved"]
] as const;

function statusLabel(status: string) {
  if (status === "in_progress") return "In progress";
  if (status === "waiting_customer") return "Waiting for member";
  if (status === "resolved" || status === "closed") return "Resolved";
  return "Open";
}

function statusClass(status: string) {
  if (status === "in_progress") return styles.statusProgress;
  if (status === "waiting_customer") return styles.statusWaiting;
  if (status === "resolved" || status === "closed") return styles.statusResolved;
  return styles.statusOpen;
}

function filterHref(status: string, q: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  const suffix = params.toString();
  return suffix ? `/admin/support?${suffix}` : "/admin/support";
}

export default async function AdminSupportPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const statusFilter = filterOptions.some(([value]) => value === query.status) ? query.status || "all" : "all";
  const search = (query.q || "").trim().toLowerCase().slice(0, 80);

  const { data: ticketData } = supabase
    ? await supabase
        .from("uniplug_support_tickets")
        .select("id,user_id,subject,status,category,service_name,order_id,order_number,last_message_at,admin_unread,created_at")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150)
    : { data: [] };
  const allTickets = (ticketData || []) as Ticket[];
  const userIds = [...new Set(allTickets.map((ticket) => ticket.user_id))];
  const { data: profileData } = supabase && userIds.length
    ? await supabase.from("uniplug_profiles").select("user_id,display_name,username,email").in("user_id", userIds)
    : { data: [] };
  const profiles = new Map((profileData || []).map((profile) => [profile.user_id, profile as Profile]));

  const filteredTickets = allTickets.filter((ticket) => {
    const statusMatch = statusFilter === "all"
      || (statusFilter === "resolved" ? ["resolved", "closed"].includes(ticket.status) : ticket.status === statusFilter);
    if (!statusMatch) return false;
    if (!search) return true;
    const profile = profiles.get(ticket.user_id);
    const haystack = [ticket.subject, ticket.service_name, ticket.order_number, ticket.category, profile?.display_name, profile?.username, profile?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  const selectedTicket = allTickets.find((ticket) => ticket.id === query.ticket) || filteredTickets[0] || null;
  let messages: Message[] = [];
  let signedAttachments: Array<Attachment & { url: string | null }> = [];
  if (supabase && selectedTicket) {
    await supabase.rpc("uniplug_mark_support_ticket_read", { p_ticket_id: selectedTicket.id });
    const [{ data: messagesData }, { data: attachmentsData }] = await Promise.all([
      supabase
        .from("uniplug_support_messages")
        .select("id,sender_role,body,created_at")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("uniplug_support_attachments")
        .select("id,message_id,storage_path,file_name")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true })
    ]);
    messages = (messagesData || []) as Message[];
    signedAttachments = await Promise.all(((attachmentsData || []) as Attachment[]).map(async (attachment) => {
      const { data } = await supabase.storage.from("uniplug-support").createSignedUrl(attachment.storage_path, 300);
      return { ...attachment, url: data?.signedUrl || null };
    }));
  }

  const attachmentMap = new Map<string, typeof signedAttachments>();
  for (const attachment of signedAttachments) {
    if (!attachment.message_id) continue;
    const current = attachmentMap.get(attachment.message_id) || [];
    current.push(attachment);
    attachmentMap.set(attachment.message_id, current);
  }
  const selectedProfile = selectedTicket ? profiles.get(selectedTicket.user_id) : null;
  const openCount = allTickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length;
  const unreadCount = allTickets.filter((ticket) => ticket.admin_unread).length;

  return (
    <section className={styles.adminPage}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.kicker}>Member care</p>
          <h1>Support inbox</h1>
          <p>Reply to members with the service, order, account, and ticket history visible in one workspace.</p>
        </div>
        <span className={styles.count} title="Unread support requests">{unreadCount}</span>
      </header>

      {query.success === "reply_sent" ? <p className={styles.notice}>Reply sent and ticket status updated.</p> : null}

      <div className={styles.adminToolbar}>
        <div className={styles.filters}>
          {filterOptions.map(([value, label]) => (
            <Link className={`${styles.filter} ${statusFilter === value ? styles.filterActive : ""}`} href={filterHref(value, search)} key={value}>
              {label}{value === "open" ? ` ${openCount}` : ""}
            </Link>
          ))}
        </div>
        <form action="/admin/support" method="get">
          {statusFilter !== "all" ? <input name="status" type="hidden" value={statusFilter} /> : null}
          <input defaultValue={query.q || ""} name="q" placeholder="Search member, ticket, order or service" aria-label="Search support" style={{ minHeight: 40, width: 290, maxWidth: "100%", border: "1px solid var(--line)", borderRadius: 999, padding: "0 14px", background: "white" }} />
        </form>
      </div>

      <div className={styles.adminGrid}>
        <aside className={styles.queue} aria-label="Support queue">
          {filteredTickets.map((ticket) => {
            const profile = profiles.get(ticket.user_id);
            const params = new URLSearchParams();
            params.set("ticket", ticket.id);
            if (statusFilter !== "all") params.set("status", statusFilter);
            if (search) params.set("q", search);
            return (
              <Link className={`${styles.queueItem} ${selectedTicket?.id === ticket.id ? styles.queueItemActive : ""}`} href={`/admin/support?${params.toString()}`} key={ticket.id}>
                <div className={styles.queueTop}>
                  <strong>{ticket.subject}</strong>
                  <span className={`${styles.status} ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
                </div>
                <span>{profile?.display_name || `@${profile?.username || ticket.user_id.slice(0, 8)}`}{ticket.service_name ? ` · ${ticket.service_name}` : ""}</span>
                {ticket.order_number ? <span>Order {ticket.order_number}</span> : null}
                <small>{new Date(ticket.last_message_at || ticket.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small>
                {ticket.admin_unread ? <span className={styles.adminUnread}>● Needs attention</span> : null}
              </Link>
            );
          })}
          {!filteredTickets.length ? <div className={styles.empty}><span>✓</span><h3>No matching tickets</h3><p>The queue is clear for this filter.</p></div> : null}
        </aside>

        {selectedTicket ? (
          <section className={styles.adminThread}>
            <div className={styles.threadHeader}>
              <div>
                <p className={styles.kicker}>#{selectedTicket.id.slice(0, 8).toUpperCase()}</p>
                <h1>{selectedTicket.subject}</h1>
                <div className={styles.threadMeta}>
                  <span>{selectedTicket.category.replaceAll("_", " ")}</span>
                  {selectedTicket.service_name ? <span>{selectedTicket.service_name}</span> : null}
                  {selectedTicket.order_number ? <span>Order {selectedTicket.order_number}</span> : null}
                </div>
              </div>
              <span className={`${styles.status} ${statusClass(selectedTicket.status)}`}>{statusLabel(selectedTicket.status)}</span>
            </div>

            <div className={styles.customerStrip}>
              <div><small>Member</small><strong>{selectedProfile?.display_name || `@${selectedProfile?.username || selectedTicket.user_id.slice(0, 8)}`}</strong></div>
              <div><small>Email</small><strong>{selectedProfile?.email || "Not available"}</strong></div>
              <div><small>Service</small><strong>{selectedTicket.service_name || "General support"}</strong></div>
              <div><small>Order</small><strong>{selectedTicket.order_number || "Not attached"}</strong></div>
            </div>

            <div className={styles.adminConversation}>
              {messages.map((message) => {
                const attachments = attachmentMap.get(message.id) || [];
                return (
                  <article className={`${styles.message} ${message.sender_role === "member" ? styles.messageMember : styles.messageAdmin}`} key={message.id}>
                    <div className={styles.messageHead}>
                      <strong>{message.sender_role === "member" ? selectedProfile?.display_name || "Member" : "UniPlug Support"}</strong>
                      <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</time>
                    </div>
                    <p>{message.body}</p>
                    {attachments.length ? <div className={styles.attachments}>{attachments.map((attachment) => attachment.url ? <a className={styles.attachment} href={attachment.url} key={attachment.id} target="_blank" rel="noreferrer">📎 {attachment.file_name}</a> : null)}</div> : null}
                  </article>
                );
              })}
            </div>

            <form action={replyToSupportTicket} className={styles.form}>
              <input name="ticketId" type="hidden" value={selectedTicket.id} />
              <label>
                Reply to member
                <textarea name="message" maxLength={4000} required rows={4} placeholder="Write a clear support reply..." />
              </label>
              <div className={styles.adminReplyRow}>
                <label>
                  After reply
                  <select defaultValue={selectedTicket.status === "resolved" || selectedTicket.status === "closed" ? "resolved" : "waiting_customer"} name="status">
                    <option value="waiting_customer">Waiting for member</option>
                    <option value="in_progress">Keep in progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <button className={styles.primary} type="submit">Send reply</button>
              </div>
              <p className={styles.securityNote}><b>Security:</b> Never ask a member to send passwords, OTPs, verification codes, or payment credentials.</p>
            </form>
          </section>
        ) : (
          <section className={styles.card}><div className={styles.empty}><span>◇</span><h3>Select a ticket</h3><p>Choose a request from the queue to view its conversation.</p></div></section>
        )}
      </div>
    </section>
  );
}
