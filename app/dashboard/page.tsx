import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { requireMember } from "@/lib/auth";
import { formatDualPrice } from "@/lib/currency";
import { planDurationLabel } from "@/lib/plan-durations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { TrackedClientDashboard } from "@/components/tracked-client-views";

export const dynamic = "force-dynamic";
export const metadata = { title: "My UniPlug" };

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function DashboardPage() {
  const viewer = await requireMember();
  if (viewer.profile.clientId) {
    const tracked = await getTrackedSubscriptions(viewer.profile.clientId);
    return <TrackedClientDashboard name={viewer.profile.displayName || viewer.profile.username} subscriptions={tracked} />;
  }
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [subscriptionsResult, ordersResult, requestsResult, eventsResult] = supabase
    ? await Promise.all([
        supabase
          .from("uniplug_member_subscriptions")
          .select("id,status,start_at,current_period_end,duration_months,service:uniplug_catalog_services(id,name,slug,logo_text,accent_color),plan:uniplug_member_plans(id,plan_name,price_kes,billing_cycle,availability_status)")
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
          .limit(10),
        supabase
          .from("uniplug_member_events")
          .select("id,event_type,title,detail,entity_type,entity_id,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(8)
      ])
    : [empty, empty, empty, empty];

  const subscriptions = (subscriptionsResult.data || []) as unknown as Array<{
    id: string;
    status: string;
    start_at: string | null;
    current_period_end: string | null;
    duration_months: number;
    service: { id: string; name: string; slug: string; logo_text: string; accent_color: string } | null;
    plan: { id: string; plan_name: string; price_kes: number; billing_cycle: string; availability_status: string } | null;
  }>;
  const orders = (ordersResult.data || []) as Array<{
    id: string;
    order_number: string;
    total_kes: number;
    payment_status: string;
    fulfillment_status: string;
    created_at: string;
  }>;
  const requests = (requestsResult.data || []) as Array<{ id: string; status: string; request_type: string; created_at: string }>;
  const events = (eventsResult.data || []) as Array<{ id: string; event_type: string; title: string; detail: string | null; entity_type: string | null; entity_id: string | null; created_at: string }>;
  const nextRenewal = subscriptions
    .filter((item) => Boolean(item.current_period_end))
    .sort((a, b) => new Date(a.current_period_end!).getTime() - new Date(b.current_period_end!).getTime())[0];

  return (
    <section className="section shell page-top">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Hello, {viewer.profile.displayName || viewer.profile.username}.</h1>
          <p>Your services, orders, renewal dates, requests, and account activity are organised here.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-light" href="/dashboard/settings">Account settings</Link>
          <Link className="button button-dark" href="/services">Browse services</Link>
        </div>
      </div>

      <div className="dashboard-stats">
        <article><span>Active services</span><strong>{subscriptions.filter((item) => item.status === "active").length}</strong><small>{subscriptions.length} total service{subscriptions.length === 1 ? "" : "s"}</small></article>
        <article><span>Pending requests</span><strong>{requests.filter((request) => request.status === "pending").length}</strong><small>Pause and cancellation requests</small></article>
        <article><span>Next renewal</span><strong>{nextRenewal?.current_period_end ? new Date(nextRenewal.current_period_end).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}</strong><small>{nextRenewal?.service?.name || "No renewal scheduled"}</small></article>
      </div>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">My services</p><h2>Subscriptions</h2></div>
        </div>
        {subscriptions.length ? (
          <div className="subscription-list">
            {subscriptions.map((item) => (
              <Link className="subscription-row" href={`/dashboard/subscriptions/${item.id}`} key={item.id}>
                <ServiceArtwork
                  accentColor={item.service?.accent_color || "#6957ff"}
                  className="service-logo small"
                  logoText={item.service?.logo_text || "UP"}
                  name={item.service?.name || "Digital service"}
                  slug={item.service?.slug}
                />
                <div><strong>{item.service?.name || "Digital service"}</strong><span>{item.plan?.plan_name || "Member plan"} · {planDurationLabel(Number(item.duration_months))}</span></div>
                <span className="status-pill">{readableStatus(item.status)}</span>
                <span>{item.current_period_end ? `Renews ${new Date(item.current_period_end).toLocaleDateString("en-KE", { dateStyle: "medium" })}` : "Activation pending"}</span>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h3>No services yet</h3><p>Member purchases and admin-assigned services will appear here.</p><Link className="button button-dark" href="/services">Explore the catalog</Link></div>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Billing</p><h2>Recent orders</h2></div><Link href="/dashboard/orders">View all →</Link></div>
          <div className="member-list">
            {orders.map((order) => (
              <Link href={`/dashboard/orders/${order.id}`} key={order.id}>
                <div><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span></div>
                <div className="list-end"><strong>{formatDualPrice(Number(order.total_kes))}</strong><span>{readableStatus(order.payment_status)}</span></div>
              </Link>
            ))}
            {!orders.length ? <p className="muted-copy">No orders have been placed yet.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Account activity</p><h2>Latest updates</h2></div></div>
          <div className="activity-list">
            {events.map((event) => (
              <article key={event.id}>
                <span className="activity-dot" aria-hidden="true" />
                <div><strong>{event.title}</strong>{event.detail ? <p>{event.detail}</p> : null}<small>{new Date(event.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></div>
              </article>
            ))}
            {!events.length ? <p className="muted-copy">Account updates will appear here after the Phase 2 migration is applied.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
