import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatDualPrice } from "@/lib/currency";
import { formatMemberDateTime, memberStatusClass, memberStatusLabel } from "@/lib/member-dashboard";
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

  const orders = (ordersResult?.data || []) as Array<{
    id: string;
    order_number: string;
    total_kes: number;
    payment_status: string;
    fulfillment_status: string;
    paystack_channel: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  const ordersUnavailable = !supabase || Boolean(ordersResult?.error);
  const statsUnavailable = !supabase || Boolean(totalResult?.error || paidResult?.error || activeResult?.error);

  return (
    <section className="section shell page-top">
      <div className="dashboard-heading">
        <div><p className="eyebrow">Payments & receipts</p><h1>Your orders</h1><p>Review payment status, activation progress, and receipts.</p></div>
        <Link className="button button-dark" href="/services">Add a service</Link>
      </div>

      {ordersUnavailable || statsUnavailable ? <p className="form-error page-notice">Some order information could not be loaded. Refresh this page to try again.</p> : null}

      {!statsUnavailable ? <div className="dashboard-stats compact-stats">
        <article><span>Total orders</span><strong>{totalResult?.count ?? 0}</strong><small>All recorded purchases</small></article>
        <article><span>Paid</span><strong>{paidResult?.count ?? 0}</strong><small>Payment confirmed</small></article>
        <article><span>Active</span><strong>{activeResult?.count ?? 0}</strong><small>Activated or completed</small></article>
      </div> : null}

      <section className="panel order-history-panel">
        {ordersUnavailable ? (
          <div className="empty-state"><h3>We could not load your orders</h3><p>Refresh this page to try again.</p><Link className="button button-light" href="/dashboard/orders">Retry</Link></div>
        ) : <div className="member-list order-history-list">
          {orders.map((order) => (
            <Link href={`/dashboard/orders/${order.id}`} key={order.id}>
              <div className="order-number-block"><strong>{order.order_number}</strong><span>{formatMemberDateTime(order.created_at)}</span></div>
              <span className={memberStatusClass(order.payment_status)}>{memberStatusLabel(order.payment_status)}</span>
              <span className={memberStatusClass(order.fulfillment_status, "subtle")}>{memberStatusLabel(order.fulfillment_status)}</span>
              <div className="list-end"><strong>{formatDualPrice(Number(order.total_kes))}</strong><span>{order.paystack_channel || "Payment channel pending"}</span></div>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
          {!orders.length ? <div className="empty-state"><h3>No orders yet</h3><p>Your completed and pending purchases will appear here.</p><Link className="button button-dark" href="/services">Browse services</Link></div> : null}
        </div>}
      </section>
    </section>
  );
}
