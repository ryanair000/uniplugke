import Link from "next/link";
import {
  DashboardNotice,
  StatusBadge,
  daysUntil,
  eventHref,
  formatDate,
  formatKes,
  renewalLabel
} from "@/components/member-dashboard";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My UniPlug" };

type Subscription = {
  id: string;
  status: string;
  start_at: string | null;
  current_period_end: string | null;
  service: { id: string; name: string; slug: string; logo_text: string; accent_color: string } | null;
  plan: { id: string; plan_name: string; price_kes: number; billing_cycle: string; availability_status: string } | null;
};

type Order = {
  id: string;
  order_number: string;
  total_kes: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

type Event = {
  id: string;
  event_type: string;
  title: string;
  detail: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export default async function DashboardPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>>, error: null };
  const [subscriptionsResult, ordersResult, requestsResult, eventsResult] = supabase
    ? await Promise.all([
        supabase
          .from("uniplug_member_subscriptions")
          .select("id,status,start_at,current_period_end,service:uniplug_catalog_services(id,name,slug,logo_text,accent_color),plan:uniplug_member_plans(id,plan_name,price_kes,billing_cycle,availability_status)")
          .eq("user_id", viewer.user.id)
          .order("current_period_end"),
        supabase
          .from("uniplug_member_orders")
          .select("id,order_number,total_kes,payment_status,fulfillment_status,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("uniplug_subscription_requests")
          .select("id,status,request_type,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("uniplug_member_events")
          .select("id,event_type,title,detail,entity_type,entity_id,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(8)
      ])
    : [empty, empty, empty, empty];

  const subscriptions = (subscriptionsResult.data || []) as unknown as Subscription[];
  const orders = (ordersResult.data || []) as Order[];
  const requests = (requestsResult.data || []) as Array<{ id: string; status: string; request_type: string; created_at: string }>;
  const events = (eventsResult.data || []) as Event[];
  const hasLoadError = Boolean(subscriptionsResult.error || ordersResult.error || requestsResult.error || eventsResult.error);

  const now = Date.now();
  const activeServices = subscriptions.filter((item) => item.status === "active");
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const needsAttention = subscriptions.filter((item) => ["past_due", "pending_activation"].includes(item.status)).length + pendingRequests.length;
  const renewalEligible = subscriptions
    .filter((item) => ["active", "past_due"].includes(item.status))
    .filter((item) => item.current_period_end && new Date(item.current_period_end).getTime() >= now)
    .sort((a, b) => new Date(a.current_period_end!).getTime() - new Date(b.current_period_end!).getTime());
  const nextRenewal = renewalEligible[0];
  const renewalDays = daysUntil(nextRenewal?.current_period_end);
  const pastDue = subscriptions.find((item) => item.status === "past_due");
  const pendingActivation = subscriptions.find((item) => item.status === "pending_activation");

  const previewServices = [...subscriptions]
    .sort((a, b) => {
      const priority = (status: string) => ({ past_due: 0, pending_activation: 1, active: 2, paused: 3, expired: 4 }[status] ?? 5);
      const byStatus = priority(a.status) - priority(b.status);
      if (byStatus !== 0) return byStatus;
      return (a.current_period_end ? new Date(a.current_period_end).getTime() : Number.MAX_SAFE_INTEGER) - (b.current_period_end ? new Date(b.current_period_end).getTime() : Number.MAX_SAFE_INTEGER);
    })
    .slice(0, 4);

  return (
    <section className="member-page">
      <div className="dashboard-heading dashboard-heading-v2">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Good to see you, {viewer.profile.displayName || viewer.profile.username}.</h1>
          <p>Manage services, renewals, orders and support from one place.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-light" href="/dashboard/subscriptions">My services</Link>
          <Link className="button button-dark" href="/services">Browse services</Link>
        </div>
      </div>

      {hasLoadError ? (
        <DashboardNotice tone="danger" title="Some account data could not load" body="Your account is still safe. Refresh the page, and contact support if this continues." href="/dashboard/support" action="Get help" />
      ) : pastDue ? (
        <DashboardNotice tone="warning" title={`${pastDue.service?.name || "A service"} needs attention`} body="The service is marked past due. Review the subscription before access is affected." href={`/dashboard/subscriptions/${pastDue.id}`} action="Review service" />
      ) : pendingActivation ? (
        <DashboardNotice tone="info" title={`${pendingActivation.service?.name || "Your service"} is being activated`} body="We have your order. You can follow the service status from its management page." href={`/dashboard/subscriptions/${pendingActivation.id}`} action="Track activation" />
      ) : nextRenewal && renewalDays != null && renewalDays <= 7 ? (
        <DashboardNotice tone="warning" title={`${nextRenewal.service?.name || "Your service"} renews soon`} body={`${renewalLabel(nextRenewal.current_period_end)} for ${formatKes(nextRenewal.plan?.price_kes)}.`} href={`/dashboard/subscriptions/${nextRenewal.id}`} action="Review renewal" />
      ) : pendingRequests.length ? (
        <DashboardNotice tone="info" title={`${pendingRequests.length} request${pendingRequests.length === 1 ? " is" : "s are"} under review`} body="Your access stays unchanged while UniPlug reviews pause or cancellation requests." href="/dashboard/subscriptions" action="View services" />
      ) : (
        <DashboardNotice tone="success" title="Everything looks good" body="There are no urgent service or account actions right now." />
      )}

      <div className="dashboard-stats dashboard-stats-v2">
        <article><span>Active services</span><strong>{activeServices.length}</strong><small>{subscriptions.length} total service{subscriptions.length === 1 ? "" : "s"}</small></article>
        <article><span>Next renewal</span><strong>{nextRenewal?.current_period_end ? formatDate(nextRenewal.current_period_end, { month: "short", day: "numeric" }) : "—"}</strong><small>{nextRenewal?.service?.name || "Nothing scheduled"}</small></article>
        <article><span>Renewal amount</span><strong className="stat-money">{nextRenewal?.plan ? formatKes(nextRenewal.plan.price_kes) : "—"}</strong><small>{nextRenewal?.plan?.billing_cycle ? `${nextRenewal.plan.billing_cycle} plan` : "No upcoming charge"}</small></article>
        <article><span>Needs attention</span><strong>{needsAttention}</strong><small>Activations, past-due items and requests</small></article>
      </div>

      <section className="dashboard-section dashboard-section-v2">
        <div className="section-heading compact dashboard-section-heading">
          <div><p className="eyebrow">My services</p><h2>Subscriptions</h2></div>
          <Link href="/dashboard/subscriptions">View all →</Link>
        </div>
        {previewServices.length ? (
          <div className="service-overview-list">
            {previewServices.map((item) => (
              <Link className="service-overview-row" href={`/dashboard/subscriptions/${item.id}`} key={item.id}>
                <div className="service-logo small" style={{ background: item.service?.accent_color || "#6957ff" }}>{item.service?.logo_text || "UP"}</div>
                <div className="service-overview-main">
                  <strong>{item.service?.name || "Digital service"}</strong>
                  <span>{item.plan?.plan_name || "Member plan"}{item.plan ? ` · ${formatKes(item.plan.price_kes)}/${item.plan.billing_cycle}` : ""}</span>
                </div>
                <StatusBadge status={item.status} />
                <div className="service-renewal-copy"><strong>{renewalLabel(item.current_period_end)}</strong><span>{item.current_period_end ? formatDate(item.current_period_end) : "Activation date pending"}</span></div>
                <b className="row-action">Manage →</b>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h3>No services yet</h3><p>Your purchases and assigned services will appear here.</p><Link className="button button-dark" href="/services">Explore the catalog</Link></div>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="panel dashboard-panel">
          <div className="section-heading compact"><div><p className="eyebrow">Billing</p><h2>Recent orders</h2></div><Link href="/dashboard/orders">View all →</Link></div>
          <div className="member-list">
            {orders.map((order) => (
              <Link href={`/dashboard/orders/${order.id}`} key={order.id}>
                <div><strong>{order.order_number}</strong><span>{formatDate(order.created_at)}</span></div>
                <div className="list-end"><strong>{formatKes(Number(order.total_kes))}</strong><StatusBadge status={order.payment_status} /></div>
              </Link>
            ))}
            {!orders.length ? <p className="muted-copy">No orders have been placed yet.</p> : null}
          </div>
        </section>

        <section className="panel dashboard-panel">
          <div className="section-heading compact"><div><p className="eyebrow">Account activity</p><h2>Latest updates</h2></div></div>
          <div className="activity-list">
            {events.map((event) => {
              const href = eventHref(event.entity_type, event.entity_id);
              const content = <><span className="activity-dot" aria-hidden="true" /><div><strong>{event.title}</strong>{event.detail ? <p>{event.detail}</p> : null}<small>{new Date(event.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></div>{href ? <b className="activity-arrow" aria-hidden="true">→</b> : null}</>;
              return href ? <Link className="activity-item" href={href} key={event.id}>{content}</Link> : <article key={event.id}>{content}</article>;
            })}
            {!events.length ? <p className="muted-copy">Account updates will appear here as you use UniPlug.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
