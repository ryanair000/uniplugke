import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { TrackedClientDashboard } from "@/components/tracked-client-views";
import { requireMember } from "@/lib/auth";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { formatDualPrice } from "@/lib/currency";
import {
  daysUntilMemberDate,
  formatMemberDate,
  formatMemberDateTime,
  memberEventHref,
  memberStatusClass,
  memberStatusLabel,
  servicePeriodCopy
} from "@/lib/member-dashboard";
import { planDurationLabel } from "@/lib/plan-durations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My UniPlug" };

type Subscription = {
  id: string;
  status: string;
  start_at: string | null;
  current_period_end: string | null;
  duration_months: number;
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
};

function currentTimeMs() {
  return Date.now();
}

function attentionItems(subscriptions: Subscription[], orders: MemberOrder[]) {
  const items: Array<AttentionItem & { priority: number }> = [];

  for (const subscription of subscriptions) {
    const serviceName = subscription.service?.name || "Digital service";
    const href = `/dashboard/subscriptions/${subscription.id}`;

    if (subscription.status === "past_due") {
      items.push({ key: `past-due-${subscription.id}`, title: `${serviceName} needs attention`, detail: "A payment or renewal issue may affect this service.", href, action: "Manage service →", priority: 100 });
      continue;
    }

    if (subscription.status === "expired") {
      items.push({ key: `expired-${subscription.id}`, title: `${serviceName} has expired`, detail: "Renew the service if you want to restore access.", href, action: "View renewal →", priority: 90 });
      continue;
    }

    if (subscription.status === "pending_activation") {
      const hoursWaiting = (currentTimeMs() - new Date(subscription.created_at).getTime()) / 3_600_000;
      if (hoursWaiting >= 24) {
        items.push({ key: `activation-${subscription.id}`, title: `${serviceName} activation is taking longer than expected`, detail: "Open the service for the latest activation information or support options.", href, action: "Track service →", priority: 80 });
      }
      continue;
    }

    if (subscription.status === "active" && subscription.current_period_end && !subscription.auto_renew) {
      const days = daysUntilMemberDate(subscription.current_period_end);
      if (days >= 0 && days <= 7) {
        const detail = days === 0 ? "Your access ends today." : days === 1 ? "Your access ends tomorrow." : `Your access ends in ${days} days.`;
        items.push({ key: `expiry-${subscription.id}`, title: `${serviceName} expires soon`, detail, href, action: "Renew service →", priority: 70 + (7 - days) });
      }
    }
  }

  for (const order of orders) {
    if (["failed", "initialization_failed", "amount_mismatch"].includes(order.payment_status)) {
      items.push({ key: `payment-${order.id}`, title: `Payment issue on ${order.order_number}`, detail: "The payment did not complete successfully.", href: `/dashboard/orders/${order.id}`, action: "View order →", priority: 95 });
    } else if (order.fulfillment_status === "manual_review") {
      items.push({ key: `review-${order.id}`, title: `${order.order_number} is under review`, detail: "UniPlug is reviewing this order before activation can continue.", href: `/dashboard/orders/${order.id}`, action: "View update →", priority: 75 });
    }
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

export default async function DashboardPage() {
  const viewer = await requireMember();
  if (viewer.profile.clientId) {
    const tracked = await getTrackedSubscriptions(viewer.profile.clientId);
    return <TrackedClientDashboard name={viewer.profile.displayName || viewer.profile.username} subscriptions={tracked} />;
  }

  const supabase = await createServerSupabaseClient();
  const [subscriptionsResult, ordersResult, pendingRequestsResult, eventsResult] = supabase
    ? await Promise.all([
        supabase
          .from("uniplug_member_subscriptions")
          .select("id,status,start_at,current_period_end,duration_months,auto_renew,created_at,service:uniplug_catalog_services(id,name,slug,logo_text,accent_color),plan:uniplug_member_plans(id,plan_name,price_kes,billing_cycle,availability_status)")
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
          .limit(8)
      ])
    : [null, null, null, null];

  const subscriptions = ((subscriptionsResult?.data || []) as unknown) as Subscription[];
  const orders = (ordersResult?.data || []) as MemberOrder[];
  const events = (eventsResult?.data || []) as MemberEvent[];
  const activeCount = subscriptions.filter((item) => item.status === "active").length;
  const pendingRequestsCount = pendingRequestsResult?.count ?? 0;
  const attention = attentionItems(subscriptions, orders);
  const now = currentTimeMs();
  const nextServiceDate = subscriptions
    .filter((item) => ["active", "past_due"].includes(item.status) && Boolean(item.current_period_end) && new Date(item.current_period_end!).getTime() >= now)
    .sort((a, b) => new Date(a.current_period_end!).getTime() - new Date(b.current_period_end!).getTime())[0];

  const subscriptionsUnavailable = !supabase || Boolean(subscriptionsResult?.error);
  const ordersUnavailable = !supabase || Boolean(ordersResult?.error);
  const requestsUnavailable = !supabase || Boolean(pendingRequestsResult?.error);
  const eventsUnavailable = !supabase || Boolean(eventsResult?.error);
  const hasPartialFailure = subscriptionsUnavailable || ordersUnavailable || requestsUnavailable || eventsUnavailable;

  return (
    <section className="section shell page-top">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Welcome back, {viewer.profile.displayName || viewer.profile.username}.</h1>
          <p>{attention.length ? `${attention.length} item${attention.length === 1 ? " needs" : "s need"} your attention.` : "Your services, payments, and account updates are together here."}</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-light" href="/dashboard/settings">Account</Link>
          <Link className="button button-dark" href="/services">View catalog</Link>
        </div>
      </div>

      {hasPartialFailure ? <p className="form-error page-notice">Some account information could not be loaded. The sections that loaded successfully are still shown below.</p> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>Active services</span><strong>{subscriptionsUnavailable ? "—" : activeCount}</strong><small>{subscriptionsUnavailable ? "Temporarily unavailable" : `${subscriptions.length} total service${subscriptions.length === 1 ? "" : "s"}`}</small></article>
        <article><span>Pending requests</span><strong>{requestsUnavailable ? "—" : pendingRequestsCount}</strong><small>Pause and cancellation requests</small></article>
        <article><span>Next service date</span><strong>{subscriptionsUnavailable || !nextServiceDate?.current_period_end ? "—" : formatMemberDate(nextServiceDate.current_period_end, { month: "short", day: "numeric" })}</strong><small>{subscriptionsUnavailable ? "Temporarily unavailable" : nextServiceDate?.service?.name || "Nothing scheduled"}</small></article>
      </div>

      {attention.length ? (
        <section className="panel dashboard-section">
          <div className="section-heading compact"><div><p className="eyebrow">Action centre</p><h2>Needs attention</h2></div></div>
          <div className="member-list">
            {attention.map((item) => <Link href={item.href} key={item.key}><div><strong>{item.title}</strong><span>{item.detail}</span></div><div className="list-end"><strong>{item.action}</strong></div></Link>)}
          </div>
        </section>
      ) : null}

      <section className="dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">My services</p><h2>Subscriptions</h2></div>
          <Link href="/dashboard/subscriptions">View all →</Link>
        </div>
        {subscriptionsUnavailable ? (
          <div className="empty-state"><h3>We could not load your services</h3><p>Refresh the dashboard to try again.</p><Link className="button button-light" href="/dashboard">Retry</Link></div>
        ) : subscriptions.length ? (
          <div className="subscription-list">
            {subscriptions.map((item) => (
              <Link className="subscription-row" href={`/dashboard/subscriptions/${item.id}`} key={item.id}>
                <ServiceArtwork accentColor={item.service?.accent_color || "#6957ff"} className="service-logo small" logoText={item.service?.logo_text || "UP"} name={item.service?.name || "Digital service"} slug={item.service?.slug} />
                <div><strong>{item.service?.name || "Digital service"}</strong><span>{item.plan?.plan_name || "Member plan"} · {planDurationLabel(Number(item.duration_months))}</span></div>
                <span className={memberStatusClass(item.status)}>{memberStatusLabel(item.status)}</span>
                <span>{servicePeriodCopy(item.current_period_end, item.auto_renew)}</span>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h3>No services yet</h3><p>Services purchased through your member account will appear here.</p><Link className="button button-dark" href="/services">Explore the catalog</Link></div>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Billing</p><h2>Recent orders</h2></div><Link href="/dashboard/orders">View all →</Link></div>
          {ordersUnavailable ? <p className="muted-copy">Orders could not be loaded. Refresh the dashboard to try again.</p> : <div className="member-list">
            {orders.slice(0, 5).map((order) => (
              <Link href={`/dashboard/orders/${order.id}`} key={order.id}>
                <div><strong>{order.order_number}</strong><span>{formatMemberDate(order.created_at)}</span></div>
                <div className="list-end"><strong>{formatDualPrice(Number(order.total_kes))}</strong><span className={memberStatusClass(order.payment_status)}>{memberStatusLabel(order.payment_status)}</span></div>
              </Link>
            ))}
            {!orders.length ? <p className="muted-copy">You have not placed an order yet.</p> : null}
          </div>}
        </section>

        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Account activity</p><h2>Latest updates</h2></div><Link href="/dashboard/notifications">View all →</Link></div>
          {eventsUnavailable ? <p className="muted-copy">Account activity could not be loaded. Refresh the dashboard to try again.</p> : <div className="activity-list">
            {events.map((event) => {
              const href = memberEventHref(event.entity_type, event.entity_id);
              const content = <><span className="activity-dot" aria-hidden="true" /><div><strong>{event.title}</strong>{event.detail ? <p>{event.detail}</p> : null}<small>{formatMemberDateTime(event.created_at)}</small>{href ? <p className="wallet-text-link">View details →</p> : null}</div></>;
              return href ? <Link href={href} key={event.id}>{content}</Link> : <article key={event.id}>{content}</article>;
            })}
            {!events.length ? <p className="muted-copy">Account updates will appear here as you use UniPlug.</p> : null}
          </div>}
        </section>
      </div>
    </section>
  );
}
