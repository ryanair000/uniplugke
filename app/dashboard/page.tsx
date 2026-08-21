import Link from "next/link";
import { requireMember } from "@/lib/auth";
import {
  daysUntil,
  eventHref,
  formatDateKe,
  formatDateTimeKe,
  formatKes,
  statusClassName,
  statusLabel,
  subscriptionDateLabel
} from "@/lib/dashboard-ui";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My UniPlug" };

type Subscription = {
  id: string;
  status: string;
  start_at: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  created_at: string;
  service: { id: string; name: string; slug: string; logo_text: string; accent_color: string } | null;
  plan: { id: string; plan_name: string; price_kes: number; billing_cycle: string; availability_status: string } | null;
};

type MemberOrder = {
  id: string;
  order_number: string;
  total_kes: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

type MemberEvent = {
  id: string;
  event_type: string;
  title: string;
  detail: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type AttentionItem = {
  key: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  tone: "warning" | "danger";
  priority: number;
};

function buildAttentionItems(subscriptions: Subscription[], orders: MemberOrder[]) {
  const items: AttentionItem[] = [];

  for (const subscription of subscriptions) {
    const serviceName = subscription.service?.name || "Digital service";
    const href = `/dashboard/subscriptions/${subscription.id}`;

    if (subscription.status === "past_due") {
      items.push({ key: `past-due-${subscription.id}`, title: `${serviceName} needs payment`, detail: "Your service needs attention to keep access running smoothly.", href, action: "Manage service →", tone: "danger", priority: 100 });
      continue;
    }

    if (subscription.status === "expired") {
      items.push({ key: `expired-${subscription.id}`, title: `${serviceName} has expired`, detail: "Renew the service if you want to restore access.", href, action: "View renewal →", tone: "warning", priority: 85 });
      continue;
    }

    if (subscription.status === "pending_activation") {
      const hoursWaiting = (Date.now() - new Date(subscription.created_at).getTime()) / 3_600_000;
      if (hoursWaiting >= 24) {
        items.push({ key: `activation-${subscription.id}`, title: `${serviceName} activation is taking longer than expected`, detail: "Open the service to check the latest activation information or contact support.", href, action: "Track service →", tone: "warning", priority: 80 });
      }
      continue;
    }

    if (subscription.status === "active" && subscription.current_period_end && !subscription.auto_renew) {
      const days = daysUntil(subscription.current_period_end);
      if (days >= 0 && days <= 7) {
        const detail = days === 0 ? "Your access ends today." : days === 1 ? "Your access ends tomorrow." : `Your access ends in ${days} days.`;
        items.push({ key: `expiry-${subscription.id}`, title: `${serviceName} expires soon`, detail, href, action: "Renew service →", tone: days <= 2 ? "danger" : "warning", priority: 70 + (7 - days) });
      }
    }
  }

  for (const order of orders) {
    if (["failed", "initialization_failed", "amount_mismatch"].includes(order.payment_status)) {
      items.push({ key: `payment-${order.id}`, title: `Payment issue on ${order.order_number}`, detail: "The payment did not complete successfully. Open the order for details.", href: `/dashboard/orders/${order.id}`, action: "View order →", tone: "danger", priority: 95 });
    } else if (order.fulfillment_status === "manual_review") {
      items.push({ key: `review-${order.id}`, title: `${order.order_number} is under review`, detail: "UniPlug is reviewing this order before the service can be completed.", href: `/dashboard/orders/${order.id}`, action: "View update →", tone: "warning", priority: 75 });
    }
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

export default async function DashboardPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();

  const [subscriptionsResult, ordersResult, pendingRequestsResult, eventsResult] = supabase
    ? await Promise.all([
        supabase
          .from("uniplug_member_subscriptions")
          .select("id,status,start_at,current_period_end,auto_renew,created_at,service:uniplug_catalog_services(id,name,slug,logo_text,accent_color),plan:uniplug_member_plans(id,plan_name,price_kes,billing_cycle,availability_status)")
          .eq("user_id", viewer.user.id)
          .order("current_period_end"),
        supabase
          .from("uniplug_member_orders")
          .select("id,order_number,total_kes,payment_status,fulfillment_status,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("uniplug_subscription_requests")
          .select("id", { count: "exact", head: true })
          .eq("user_id", viewer.user.id)
          .eq("status", "pending"),
        supabase
          .from("uniplug_member_events")
          .select("id,event_type,title,detail,entity_type,entity_id,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(6)
      ])
    : [null, null, null, null];

  const subscriptions = ((subscriptionsResult?.data || []) as unknown) as Subscription[];
  const orders = (ordersResult?.data || []) as MemberOrder[];
  const events = (eventsResult?.data || []) as MemberEvent[];
  const activeServicesCount = subscriptions.filter((item) => item.status === "active").length;
  const pendingRequestsCount = pendingRequestsResult?.count ?? 0;
  const attentionItems = buildAttentionItems(subscriptions, orders);
  const now = Date.now();
  const nextExpiry = subscriptions
    .filter((item) => ["active", "past_due"].includes(item.status) && Boolean(item.current_period_end) && new Date(item.current_period_end!).getTime() >= now)
    .sort((a, b) => new Date(a.current_period_end!).getTime() - new Date(b.current_period_end!).getTime())[0];

  const subscriptionsUnavailable = !supabase || Boolean(subscriptionsResult?.error);
  const ordersUnavailable = !supabase || Boolean(ordersResult?.error);
  const requestsUnavailable = !supabase || Boolean(pendingRequestsResult?.error);
  const eventsUnavailable = !supabase || Boolean(eventsResult?.error);
  const hasLoadWarning = subscriptionsUnavailable || ordersUnavailable || requestsUnavailable || eventsUnavailable;
  const displayName = viewer.profile.displayName || viewer.profile.username;

  return (
    <section className="dashboard-overview">
      <header className="dashboard-v2-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Welcome back, {displayName}.</h1>
          <p>{attentionItems.length ? `${attentionItems.length} item${attentionItems.length === 1 ? " needs" : "s need"} your attention.` : "Your services are up to date. Here is what is happening with your account."}</p>
        </div>
        <div className="dashboard-v2-heading-actions">
          <Link className="button button-light small" href="/settings">Account</Link>
          <Link className="button button-dark small" href="/services">Browse services</Link>
        </div>
      </header>

      {hasLoadWarning ? (
        <div className="dashboard-load-warning" role="status">
          <span>Some account information could not be loaded. The sections that loaded successfully are still shown below.</span>
          <Link href="/dashboard">Retry</Link>
        </div>
      ) : null}

      <div className="dashboard-kpis" aria-label="Account summary">
        <article className="dashboard-kpi"><span>Active services</span><strong>{subscriptionsUnavailable ? "—" : activeServicesCount}</strong><small>{subscriptionsUnavailable ? "Temporarily unavailable" : `${subscriptions.length} total service${subscriptions.length === 1 ? "" : "s"}`}</small></article>
        <article className="dashboard-kpi"><span>Pending requests</span><strong>{requestsUnavailable ? "—" : pendingRequestsCount}</strong><small>Pause and cancellation requests</small></article>
        <article className="dashboard-kpi"><span>Next expiry</span><strong>{subscriptionsUnavailable || !nextExpiry?.current_period_end ? "—" : formatDateKe(nextExpiry.current_period_end, { month: "short", day: "numeric" })}</strong><small>{subscriptionsUnavailable ? "Temporarily unavailable" : nextExpiry?.service?.name || "No upcoming expiry"}</small></article>
      </div>

      {attentionItems.length ? (
        <section className="dashboard-v2-section" aria-labelledby="attention-heading">
          <div className="dashboard-v2-section-head"><div><p className="eyebrow">Action centre</p><h2 id="attention-heading">Needs attention</h2></div></div>
          <div className="attention-list">
            {attentionItems.map((item) => (
              <Link className={`attention-card ${item.tone}`} href={item.href} key={item.key}>
                <span className="attention-mark" aria-hidden="true">!</span>
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                <span>{item.action}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dashboard-v2-section" id="my-services" aria-labelledby="services-heading">
        <div className="dashboard-v2-section-head"><div><p className="eyebrow">My services</p><h2 id="services-heading">Services you manage</h2></div></div>
        {subscriptionsUnavailable ? (
          <div className="dashboard-section-error"><h3>We could not load your services</h3><p>Refresh the dashboard to try again.</p><Link className="button button-light small" href="/dashboard">Retry</Link></div>
        ) : subscriptions.length ? (
          <div className="dashboard-service-list">
            {subscriptions.map((item) => (
              <Link className="dashboard-service-row" href={`/dashboard/subscriptions/${item.id}`} key={item.id}>
                <div className="service-logo small" style={{ background: item.service?.accent_color || "#6957ff" }}>{item.service?.logo_text || "UP"}</div>
                <div className="dashboard-service-copy"><strong>{item.service?.name || "Digital service"}</strong><span>{item.plan?.plan_name || "Member plan"}{item.plan?.billing_cycle ? ` · ${item.plan.billing_cycle}` : ""}</span></div>
                <span className={statusClassName(item.status)}>{statusLabel(item.status)}</span>
                <span className="dashboard-service-date">{subscriptionDateLabel(item.current_period_end, item.auto_renew)}</span>
                <span className="dashboard-row-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty"><h3>No services yet</h3><p>Services you purchase or that UniPlug assigns to your account will appear here.</p><Link className="button button-dark small" href="/services">Explore services</Link></div>
        )}
      </section>

      <div className="dashboard-bottom-grid">
        <section className="dashboard-v2-panel">
          <div className="dashboard-v2-section-head"><div><p className="eyebrow">Billing</p><h2>Recent orders</h2></div><Link href="/dashboard/orders">View all →</Link></div>
          {ordersUnavailable ? (
            <div className="dashboard-section-error"><h3>Orders are unavailable</h3><p>Refresh the dashboard to try again.</p></div>
          ) : (
            <div className="dashboard-order-list">
              {orders.slice(0, 5).map((order) => (
                <Link className="dashboard-order-row" href={`/dashboard/orders/${order.id}`} key={order.id}>
                  <div><strong>{order.order_number}</strong><span>{formatDateKe(order.created_at)}</span></div>
                  <div className="dashboard-order-end"><strong>{formatKes(Number(order.total_kes))}</strong><span className={statusClassName(order.payment_status)}>{statusLabel(order.payment_status)}</span></div>
                </Link>
              ))}
              {!orders.length ? <p className="muted-copy">You have not placed an order yet.</p> : null}
            </div>
          )}
        </section>

        <section className="dashboard-v2-panel">
          <div className="dashboard-v2-section-head"><div><p className="eyebrow">Account activity</p><h2>Latest updates</h2></div></div>
          {eventsUnavailable ? (
            <div className="dashboard-section-error"><h3>Activity is unavailable</h3><p>Refresh the dashboard to try again.</p></div>
          ) : (
            <div className="dashboard-activity-list">
              {events.map((event) => {
                const href = eventHref(event.entity_type, event.entity_id);
                const content = <><span className="dashboard-activity-dot" aria-hidden="true" /><div><strong>{event.title}</strong>{event.detail ? <p>{event.detail}</p> : null}<small>{formatDateTimeKe(event.created_at)}</small></div>{href ? <span className="dashboard-activity-arrow">View →</span> : null}</>;
                return href ? <Link className="dashboard-activity-row" href={href} key={event.id}>{content}</Link> : <article className="dashboard-activity-row static" key={event.id}>{content}</article>;
              })}
              {!events.length ? <p className="muted-copy">Account updates will appear here as you use UniPlug.</p> : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
