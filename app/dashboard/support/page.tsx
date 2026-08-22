import Link from "next/link";
import { createSupportTicket } from "@/app/help/actions";
import styles from "@/components/support-ui.module.css";
import { requireMember } from "@/lib/auth";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = [
  ["login", "Login"],
  ["service", "Service"],
  ["verification", "Verification"],
  ["billing", "Billing"],
  ["account", "Account"],
  ["other", "Other"]
] as const;

type Ticket = {
  id: string;
  public_id: string;
  subject: string;
  status: string;
  category: string;
  service_name: string | null;
  order_number: string | null;
  last_message_at: string | null;
  member_unread: boolean;
  created_at: string;
};

type ServiceOption = { value: string; label: string };

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

function supportError(code: string | undefined) {
  if (code === "invalid_attachment") return "That screenshot was rejected. Use a real JPG, PNG, or WEBP image up to 5 MB.";
  if (code === "ticket_not_found") return "That support request could not be found.";
  if (code === "rate_limited") return "You are sending requests too quickly. Try again in a moment.";
  if (code) return "The request could not be sent. Check the details and try again.";
  return null;
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireMember();
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data } = supabase
    ? await supabase
        .from("uniplug_support_tickets")
        .select("id,public_id,subject,status,category,service_name,order_number,last_message_at,member_unread,created_at")
        .eq("user_id", viewer.user.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50)
    : { data: [] };
  const tickets = (data || []) as Ticket[];

  let serviceOptions: ServiceOption[] = [];
  if (viewer.profile.clientId) {
    const tracked = await getTrackedSubscriptions(viewer.profile.clientId);
    serviceOptions = tracked.map((subscription) => ({
      value: `tracked:${subscription.id}`,
      label: subscription.service?.name || subscription.serviceIdentifier || "Tracked service"
    }));
  } else if (supabase) {
    const { data: subscriptions } = await supabase
      .from("uniplug_member_subscriptions")
      .select("id,service:uniplug_catalog_services(name)")
      .eq("user_id", viewer.user.id)
      .order("created_at", { ascending: false });
    serviceOptions = (subscriptions || []).map((subscription) => {
      const service = Array.isArray(subscription.service) ? subscription.service[0] : subscription.service;
      return { value: `member:${subscription.id}`, label: service?.name || "Digital service" };
    });
  }

  let orderContext: { id: string; orderNumber: string; serviceName: string | null } | null = null;
  if (supabase && uuidPattern.test(query.order || "")) {
    const { data: order } = await supabase
      .from("uniplug_member_orders")
      .select("id,order_number")
      .eq("id", query.order)
      .eq("user_id", viewer.user.id)
      .maybeSingle();
    if (order) {
      const { data: item } = await supabase
        .from("uniplug_member_order_items")
        .select("service_name")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      orderContext = {
        id: order.id,
        orderNumber: String(order.order_number || "").slice(0, 80),
        serviceName: item?.service_name ? String(item.service_name).slice(0, 120) : null
      };
    }
  }

  const service = ((query.service || orderContext?.serviceName) || "").trim().slice(0, 120);
  const renewal = query.topic === "renewal";
  const verify = query.topic === "verify";
  const orderHelp = Boolean(orderContext);
  const provider = query.provider === "netflix" ? "Netflix" : "VeriFy";
  const matchingService = serviceOptions.find((option) => option.label.toLowerCase() === service.toLowerCase());
  const defaultContext = query.subscription && serviceOptions.some((option) => option.value.endsWith(`:${query.subscription}`))
    ? serviceOptions.find((option) => option.value.endsWith(`:${query.subscription}`))?.value || ""
    : matchingService?.value || "";
  const defaultCategory = renewal || orderHelp ? "billing" : verify ? "verification" : service ? "service" : "other";
  const defaultSubject = orderHelp
    ? `Help with order ${orderContext.orderNumber}`
    : renewal && service
      ? `Renew ${service}`
      : verify
        ? `${service || provider} VeriFy help`
        : service
          ? `${service} support`
          : "";
  const defaultMessage = orderHelp
    ? `I need help with order ${orderContext.orderNumber}${service ? ` for ${service}` : ""}.`
    : renewal && service
      ? `I would like to renew my ${service} service. Please share the next payment step.`
      : verify
        ? `I need help with ${service || provider} VeriFy. I have not included any password or verification code.`
        : "";
  const errorMessage = supportError(query.error);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1>Support</h1>
          <p>Get help with your UniPlug services and keep every reply in one secure conversation.</p>
        </div>
      </header>

      {query.success === "ticket_created" ? <p className={styles.notice}>Your support request was sent.</p> : null}
      {errorMessage ? <p className={`${styles.notice} ${styles.noticeError}`}>{errorMessage}</p> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div><p className={styles.kicker}>New request</p><h2>What do you need help with?</h2></div>
          </div>
          <form action={createSupportTicket} className={styles.form} encType="multipart/form-data">
            <input type="hidden" name="returnTo" value="/dashboard/support" />
            <input type="hidden" name="serviceName" value={service} />
            {orderContext ? <input type="hidden" name="orderId" value={orderContext.id} /> : null}

            <div>
              <p className={styles.kicker}>Issue type</p>
              <div className={styles.categoryRow} style={{ marginTop: 9 }}>
                {categories.map(([value, label]) => (
                  <label key={value}>
                    <input defaultChecked={value === defaultCategory} name="category" type="radio" value={value} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {serviceOptions.length ? (
              <label>
                Service
                <select defaultValue={defaultContext} name="subscriptionContext">
                  <option value="">General account support</option>
                  {serviceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ) : null}

            {orderContext ? <p className={styles.securityNote}><b>Order attached:</b> {orderContext.orderNumber}. Support will see this order automatically.</p> : null}

            <label>
              Subject
              <input name="subject" minLength={3} maxLength={120} required defaultValue={defaultSubject} placeholder="Briefly describe the issue" />
            </label>
            <label>
              Message
              <textarea name="message" minLength={10} maxLength={4000} required rows={6} defaultValue={defaultMessage} placeholder="Describe the problem and what you see on your screen." />
            </label>
            <label>
              Add screenshot <span className={styles.fileHint}>Optional · JPG, PNG or WEBP · max 5 MB</span>
              <input name="attachment" type="file" accept="image/jpeg,image/png,image/webp" />
            </label>
            <p className={styles.securityNote}><b>Keep it safe:</b> Never send passwords, OTPs, verification codes, or payment credentials in a support request.</p>
            <button className={styles.primary} type="submit">Send request</button>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div><p className={styles.kicker}>Your requests</p><h2>Recent support</h2></div>
            <span className={styles.count}>{tickets.length}</span>
          </div>
          {tickets.length ? (
            <div className={styles.ticketList}>
              {tickets.map((ticket) => (
                <Link className={styles.ticket} href={`/dashboard/support/${ticket.id}`} key={ticket.id}>
                  <div className={styles.ticketTop}>
                    <strong>{ticket.subject}</strong>
                    <span className={`${styles.status} ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
                  </div>
                  <div className={styles.ticketMeta}>
                    <span>{ticket.public_id}</span>
                    {ticket.service_name ? <span className={styles.ticketService}>{ticket.service_name}</span> : null}
                    {ticket.order_number ? <span>Order {ticket.order_number}</span> : null}
                    <span>{new Date(ticket.last_message_at || ticket.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
                    {ticket.member_unread ? <span className={styles.unread}>● New reply</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <span aria-hidden="true">◇</span>
              <h3>No support requests yet</h3>
              <p>When you contact support, your requests and replies will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
