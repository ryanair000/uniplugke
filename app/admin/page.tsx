import Link from "next/link";
import { formatDualPrice } from "@/lib/currency";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations overview" };

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [profilesResult, ordersResult, requestsResult, servicesResult] = supabase
    ? await Promise.all([
        supabase.from("uniplug_profiles").select("user_id,status").limit(500),
        supabase.from("uniplug_member_orders").select("id,order_number,customer_email,total_kes,payment_status,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("uniplug_subscription_requests").select("id,request_type,status,created_at,profile:uniplug_profiles(display_name,username),subscription:uniplug_member_subscriptions(service:uniplug_catalog_services(name))").eq("status", "pending").order("created_at").limit(6),
        supabase.from("uniplug_catalog_services").select("id,is_active,availability_status").limit(500)
      ])
    : [empty, empty, empty, empty];

  const profiles = (profilesResult.data || []) as Array<{ user_id: string; status: string }>;
  const orders = (ordersResult.data || []) as Array<{
    id: string;
    order_number: string;
    customer_email: string;
    total_kes: number;
    payment_status: string;
    fulfillment_status: string;
    created_at: string;
  }>;
  const requests = (requestsResult.data || []) as unknown as Array<{
    id: string;
    request_type: string;
    status: string;
    created_at: string;
    profile: { display_name: string | null; username: string } | null;
    subscription: { service: { name: string } | null } | null;
  }>;
  const services = (servicesResult.data || []) as Array<{ id: string; is_active: boolean; availability_status: string }>;
  const awaitingActivation = orders.filter((order) =>
    order.payment_status === "paid" && !["active", "completed"].includes(order.fulfillment_status)
  ).length;

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading admin-dashboard-heading">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Good work starts with a clear queue.</h1>
          <p>Monitor members, paid orders, service requests, and catalog availability from one focused workspace.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-light" href="/admin/members">Invite member</Link>
          <Link className="button button-dark" href="/admin/catalog">Add service</Link>
        </div>
      </div>

      <div className="dashboard-stats admin-stat-grid">
        <article><span>Active members</span><strong>{profiles.filter((profile) => profile.status === "active").length}</strong><small>{profiles.length} total profiles</small></article>
        <article><span>Pending requests</span><strong>{requests.length}</strong><small>Awaiting a decision</small></article>
        <article><span>Activation queue</span><strong>{awaitingActivation}</strong><small>Paid orders to fulfil</small></article>
        <article><span>Live services</span><strong>{services.filter((service) => service.is_active && service.availability_status !== "unavailable").length}</strong><small>{services.length} catalog entries</small></article>
      </div>

      <div className="dashboard-columns admin-overview-columns">
        <section className="panel">
          <div className="section-heading compact">
            <div><p className="eyebrow">Revenue operations</p><h2>Recent orders</h2></div>
            <Link href="/admin/orders">Open queue →</Link>
          </div>
          <div className="admin-list admin-list-compact">
            {orders.map((order) => (
              <div key={order.id}>
                <div>
                  <strong>{order.order_number}</strong>
                  <span>{order.customer_email} · {new Date(order.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
                </div>
                <div className="admin-list-meta">
                  <strong>{formatDualPrice(Number(order.total_kes))}</strong>
                  <span>{readableStatus(order.payment_status)} · {readableStatus(order.fulfillment_status)}</span>
                </div>
              </div>
            ))}
            {!orders.length ? <p className="muted-copy">No member orders yet.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div><p className="eyebrow">Member care</p><h2>Open requests</h2></div>
            <Link href="/admin/requests">Review all →</Link>
          </div>
          <div className="activity-list">
            {requests.map((request) => (
              <article key={request.id}>
                <span className="activity-dot" aria-hidden="true" />
                <div>
                  <strong>{request.request_type === "pause" ? "Pause" : "Cancellation"} · {request.subscription?.service?.name || "Service"}</strong>
                  <p>{request.profile?.display_name || `@${request.profile?.username || "member"}`}</p>
                  <small>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small>
                </div>
              </article>
            ))}
            {!requests.length ? <p className="muted-copy">No pending subscription requests.</p> : null}
          </div>
        </section>
      </div>

      <div className="admin-quick-grid">
        <Link href="/admin/orders"><span>01</span><strong>Orders</strong><p>Confirm paid purchases and complete activation.</p></Link>
        <Link href="/admin/requests"><span>02</span><strong>Requests</strong><p>Resolve pause and cancellation requests.</p></Link>
        <Link href="/admin/members"><span>03</span><strong>Members</strong><p>Invite people and control account access.</p></Link>
        <Link href="/admin/catalog"><span>04</span><strong>Catalog</strong><p>Publish services and manage private plans.</p></Link>
      </div>
    </section>
  );
}
