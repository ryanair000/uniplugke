import Link from "next/link";
import { StatusBadge, formatKes } from "@/components/member-dashboard";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member Support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ subscription?: string; order?: string }> }) {
  const viewer = await requireMember();
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>>, error: null };
  const [subscriptionsResult, ordersResult] = supabase
    ? await Promise.all([
        supabase
          .from("uniplug_member_subscriptions")
          .select("id,status,current_period_end,service:uniplug_catalog_services(name,logo_text,accent_color),plan:uniplug_member_plans(plan_name)")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("uniplug_member_orders")
          .select("id,order_number,total_kes,payment_status,fulfillment_status,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(20)
      ])
    : [empty, empty];

  const subscriptions = (subscriptionsResult.data || []) as unknown as Array<{
    id: string;
    status: string;
    current_period_end: string | null;
    service: { name: string; logo_text: string; accent_color: string } | null;
    plan: { plan_name: string } | null;
  }>;
  const orders = (ordersResult.data || []) as Array<{ id: string; order_number: string; total_kes: number; payment_status: string; fulfillment_status: string; created_at: string }>;
  const selectedSubscription = subscriptions.find((item) => item.id === query.subscription);
  const selectedOrder = orders.find((item) => item.id === query.order);

  const supportContext = selectedSubscription
    ? `Hello UniPlug, I need help with my ${selectedSubscription.service?.name || "service"} subscription (${selectedSubscription.plan?.plan_name || "member plan"}).`
    : selectedOrder
      ? `Hello UniPlug, I need help with order ${selectedOrder.order_number}.`
      : `Hello UniPlug, I need help with my member account @${viewer.profile.username}.`;
  const whatsappHref = `https://wa.me/254113033475?text=${encodeURIComponent(supportContext)}`;

  return (
    <section className="member-page">
      <div className="dashboard-heading dashboard-heading-v2">
        <div><p className="eyebrow">Support</p><h1>How can we help?</h1><p>Choose the service or order involved so support gets useful context immediately.</p></div>
        <a className="button button-dark" href={whatsappHref}>Open WhatsApp support</a>
      </div>

      {subscriptionsResult.error || ordersResult.error ? <div className="dashboard-notice notice-danger"><div><strong>Some account context could not load</strong><p>You can still contact support directly using the button above.</p></div></div> : null}

      {selectedSubscription || selectedOrder ? (
        <div className="dashboard-notice notice-info support-context-notice">
          <div><strong>Support context selected</strong><p>{selectedSubscription ? `${selectedSubscription.service?.name || "Service"} · ${selectedSubscription.plan?.plan_name || "Member plan"}` : selectedOrder?.order_number}</p></div>
          <Link href="/dashboard/support">Clear →</Link>
        </div>
      ) : null}

      <div className="support-quick-grid">
        <article className="panel"><span className="support-icon" aria-hidden="true">◫</span><h2>Service access</h2><p>Activation delays, sign-in problems, replacement eligibility or service questions.</p><a className="text-link" href={whatsappHref}>Ask support →</a></article>
        <article className="panel"><span className="support-icon" aria-hidden="true">▤</span><h2>Payments & orders</h2><p>Payment status, receipts, activation progress or an order you do not recognise.</p><Link className="text-link" href="/dashboard/orders">Review orders →</Link></article>
        <article className="panel"><span className="support-icon" aria-hidden="true">○</span><h2>Account help</h2><p>Profile, password, invitation email or member-access questions.</p><Link className="text-link" href="/dashboard/account">Account settings →</Link></article>
      </div>

      <div className="support-columns">
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Services</p><h2>Choose a subscription</h2></div></div>
          <div className="support-list">
            {subscriptions.map((item) => (
              <Link className={query.subscription === item.id ? "selected" : ""} href={`/dashboard/support?subscription=${item.id}`} key={item.id}>
                <div className="service-logo small" style={{ background: item.service?.accent_color || "#6957ff" }}>{item.service?.logo_text || "UP"}</div>
                <div><strong>{item.service?.name || "Digital service"}</strong><span>{item.plan?.plan_name || "Member plan"}</span></div>
                <StatusBadge status={item.status} />
              </Link>
            ))}
            {!subscriptions.length ? <p className="muted-copy">You do not have any subscriptions to select.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Orders</p><h2>Choose an order</h2></div></div>
          <div className="support-list support-order-list">
            {orders.map((order) => (
              <Link className={query.order === order.id ? "selected" : ""} href={`/dashboard/support?order=${order.id}`} key={order.id}>
                <div><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })} · {formatKes(order.total_kes)}</span></div>
                <StatusBadge status={order.payment_status} />
              </Link>
            ))}
            {!orders.length ? <p className="muted-copy">You do not have any orders to select.</p> : null}
          </div>
        </section>
      </div>

      <div className="support-safety-note"><strong>Keep your credentials private.</strong><p>UniPlug support may ask for an order number or service name. Never send your private password.</p></div>
    </section>
  );
}
