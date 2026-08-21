import Link from "next/link";
import { StatusBadge, formatKes } from "@/components/member-dashboard";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders & Billing" };

type Order = {
  id: string;
  order_number: string;
  total_kes: number;
  payment_status: string;
  fulfillment_status: string;
  paystack_channel: string | null;
  paid_at: string | null;
  created_at: string;
};

const filters = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "active", label: "Active" },
  { key: "failed", label: "Failed" }
];

function matchesStatus(order: Order, filter: string) {
  if (filter === "all") return true;
  if (filter === "pending") return order.payment_status === "pending" || ["pending_activation", "processing"].includes(order.fulfillment_status);
  if (filter === "paid") return order.payment_status === "paid";
  if (filter === "active") return ["active", "completed"].includes(order.fulfillment_status);
  if (filter === "failed") return ["failed", "cancelled", "canceled"].includes(order.payment_status) || ["failed", "cancelled", "canceled"].includes(order.fulfillment_status);
  return true;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const viewer = await requireMember();
  const query = await searchParams;
  const filter = filters.some((item) => item.key === query.status) ? query.status! : "all";
  const search = String(query.q || "").trim().toLowerCase();
  const supabase = await createServerSupabaseClient();
  const { data, error } = supabase
    ? await supabase
        .from("uniplug_member_orders")
        .select("id,order_number,total_kes,payment_status,fulfillment_status,paystack_channel,paid_at,created_at")
        .eq("user_id", viewer.user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  const orders = (data || []) as Order[];
  const orderIds = orders.map((order) => order.id);
  const itemsResult = supabase && orderIds.length
    ? await supabase.from("uniplug_member_order_items").select("order_id,service_name,plan_name").in("order_id", orderIds)
    : { data: [], error: null };
  const itemMap = new Map<string, { service_name: string; plan_name: string }>();
  for (const item of (itemsResult.data || []) as Array<{ order_id: string; service_name: string; plan_name: string }>) {
    if (!itemMap.has(item.order_id)) itemMap.set(item.order_id, item);
  }

  const visible = orders.filter((order) => {
    if (!matchesStatus(order, filter)) return false;
    if (!search) return true;
    const item = itemMap.get(order.id);
    return [order.order_number, item?.service_name, item?.plan_name, order.paystack_channel].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
  });

  const qsFor = (status: string) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (query.q) params.set("q", query.q);
    const encoded = params.toString();
    return encoded ? `/dashboard/orders?${encoded}` : "/dashboard/orders";
  };

  return (
    <section className="member-page">
      <div className="dashboard-heading dashboard-heading-v2">
        <div><p className="eyebrow">Orders & billing</p><h1>Order history</h1><p>Track payment, activation progress, receipts and completed purchases.</p></div>
        <Link className="button button-dark" href="/services">Add a service</Link>
      </div>

      {error || itemsResult.error ? <div className="dashboard-notice notice-danger"><div><strong>Some order information could not load</strong><p>Refresh the page or contact support if the problem continues.</p></div><Link href="/dashboard/support">Get help →</Link></div> : null}

      <div className="dashboard-stats compact-stats dashboard-stats-v2 order-stats">
        <article><span>Total orders</span><strong>{orders.length}</strong><small>Up to 100 recent purchases</small></article>
        <article><span>Paid</span><strong>{orders.filter((order) => order.payment_status === "paid").length}</strong><small>Payment confirmed</small></article>
        <article><span>Active</span><strong>{orders.filter((order) => ["active", "completed"].includes(order.fulfillment_status)).length}</strong><small>Activated or completed</small></article>
        <article><span>Pending</span><strong>{orders.filter((order) => matchesStatus(order, "pending")).length}</strong><small>Payment or activation in progress</small></article>
      </div>

      <div className="order-tools">
        <div className="dashboard-filter-bar" aria-label="Filter orders">
          {filters.map((item) => <Link className={filter === item.key ? "active" : ""} href={qsFor(item.key)} key={item.key}>{item.label}</Link>)}
        </div>
        <form className="order-search" method="get">
          {filter !== "all" ? <input type="hidden" name="status" value={filter} /> : null}
          <input aria-label="Search orders" name="q" defaultValue={query.q || ""} placeholder="Search order or service" />
          <button className="button button-light small">Search</button>
        </form>
      </div>

      <section className="panel order-history-panel order-history-panel-v2">
        <div className="order-history-cards">
          {visible.map((order) => {
            const item = itemMap.get(order.id);
            return (
              <Link className="order-history-card" href={`/dashboard/orders/${order.id}`} key={order.id}>
                <div className="order-service-copy"><strong>{item?.service_name || "UniPlug order"}</strong><span>{item?.plan_name ? `${item.plan_name} · ` : ""}{order.order_number}</span><small>{new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></div>
                <div className="order-status-stack"><StatusBadge status={order.payment_status} /><StatusBadge status={order.fulfillment_status} /></div>
                <div className="order-money"><strong>{formatKes(Number(order.total_kes))}</strong><span>{order.paystack_channel || "Payment channel pending"}</span></div>
                <b className="row-action" aria-hidden="true">View →</b>
              </Link>
            );
          })}
          {!visible.length ? <div className="empty-state dashboard-empty"><h3>No matching orders</h3><p>{orders.length ? "Try a different filter or search term." : "Your completed and pending purchases will appear here."}</p>{orders.length ? <Link className="button button-light" href="/dashboard/orders">Clear filters</Link> : <Link className="button button-dark" href="/services">Browse services</Link>}</div> : null}
        </div>
      </section>
    </section>
  );
}
