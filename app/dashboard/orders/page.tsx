import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order history" };

function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function OrdersPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase
        .from("uniplug_member_orders")
        .select("id,order_number,total_kes,payment_status,fulfillment_status,paystack_channel,paid_at,created_at")
        .eq("user_id", viewer.user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const orders = (data || []) as Array<{
    id: string;
    order_number: string;
    total_kes: number;
    payment_status: string;
    fulfillment_status: string;
    paystack_channel: string | null;
    paid_at: string | null;
    created_at: string;
  }>;

  return (
    <section className="section shell page-top">
      <div className="dashboard-heading">
        <div><p className="eyebrow">My UniPlug</p><h1>Order history</h1><p>Review payment status, activation progress, and individual order details.</p></div>
        <Link className="button button-dark" href="/services">Add a service</Link>
      </div>

      <div className="dashboard-stats compact-stats">
        <article><span>Total orders</span><strong>{orders.length}</strong><small>All recorded purchases</small></article>
        <article><span>Paid</span><strong>{orders.filter((order) => order.payment_status === "paid").length}</strong><small>Payment confirmed</small></article>
        <article><span>Active</span><strong>{orders.filter((order) => order.fulfillment_status === "active" || order.fulfillment_status === "completed").length}</strong><small>Activated or completed</small></article>
      </div>

      <section className="panel order-history-panel">
        <div className="member-list order-history-list">
          {orders.map((order) => (
            <Link href={`/dashboard/orders/${order.id}`} key={order.id}>
              <div className="order-number-block"><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div>
              <span className="status-pill">{readableStatus(order.payment_status)}</span>
              <span className="status-pill subtle">{readableStatus(order.fulfillment_status)}</span>
              <div className="list-end"><strong>{formatKes(Number(order.total_kes))}</strong><span>{order.paystack_channel || "Payment channel pending"}</span></div>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
          {!orders.length ? <div className="empty-state"><h3>No orders yet</h3><p>Your completed and pending purchases will appear here.</p><Link className="button button-dark" href="/services">Browse services</Link></div> : null}
        </div>
      </section>
    </section>
  );
}
