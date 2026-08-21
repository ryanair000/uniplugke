import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatDateTimeKe, formatKes, statusClassName, statusLabel } from "@/lib/dashboard-ui";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order history" };

export default async function OrdersPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();

  const [ordersResult, totalResult, paidResult, activeResult] = supabase
    ? await Promise.all([
        supabase
          .from("uniplug_member_orders")
          .select("id,order_number,total_kes,payment_status,fulfillment_status,paystack_channel,paid_at,created_at")
          .eq("user_id", viewer.user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("uniplug_member_orders").select("id", { count: "exact", head: true }).eq("user_id", viewer.user.id),
        supabase.from("uniplug_member_orders").select("id", { count: "exact", head: true }).eq("user_id", viewer.user.id).eq("payment_status", "paid"),
        supabase.from("uniplug_member_orders").select("id", { count: "exact", head: true }).eq("user_id", viewer.user.id).in("fulfillment_status", ["active", "completed"])
      ])
    : [null, null, null, null];

  const orders = ((ordersResult?.data || []) as unknown) as Array<{
    id: string;
    order_number: string;
    total_kes: number;
    payment_status: string;
    fulfillment_status: string;
    paystack_channel: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  const hasError = !supabase || Boolean(ordersResult?.error || totalResult?.error || paidResult?.error || activeResult?.error);

  return (
    <section className="section shell page-top">
      <div className="dashboard-heading">
        <div><p className="eyebrow">My UniPlug</p><h1>Order history</h1><p>Review payments, activation progress, and individual order details.</p></div>
        <Link className="button button-dark" href="/services">Add a service</Link>
      </div>

      {hasError ? <div className="dashboard-load-warning"><span>Some order information could not be loaded.</span><Link href="/dashboard/orders">Retry</Link></div> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>Total orders</span><strong>{totalResult?.count ?? "—"}</strong><small>All recorded purchases</small></article>
        <article><span>Paid</span><strong>{paidResult?.count ?? "—"}</strong><small>Payment confirmed</small></article>
        <article><span>Active</span><strong>{activeResult?.count ?? "—"}</strong><small>Activated or completed</small></article>
      </div>

      <section className="panel order-history-panel">
        {ordersResult?.error || !supabase ? (
          <div className="dashboard-section-error"><h3>We could not load your orders</h3><p>Refresh this page to try again.</p><Link className="button button-light small" href="/dashboard/orders">Retry</Link></div>
        ) : (
          <div className="member-list order-history-list">
            {orders.map((order) => (
              <Link href={`/dashboard/orders/${order.id}`} key={order.id}>
                <div className="order-number-block"><strong>{order.order_number}</strong><span>{formatDateTimeKe(order.created_at)}</span></div>
                <span className={statusClassName(order.payment_status)}>{statusLabel(order.payment_status)}</span>
                <span className={statusClassName(order.fulfillment_status)}>{statusLabel(order.fulfillment_status)}</span>
                <div className="list-end"><strong>{formatKes(Number(order.total_kes))}</strong><span>{order.paystack_channel || "Payment channel pending"}</span></div>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
            {!orders.length ? <div className="empty-state"><h3>No orders yet</h3><p>Your completed and pending purchases will appear here.</p><Link className="button button-dark" href="/services">Browse services</Link></div> : null}
          </div>
        )}
      </section>
    </section>
  );
}
