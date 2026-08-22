import { activateMemberOrder, markKeyOrderDelivered } from "@/app/admin/actions";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminTabs, AdminToolbar } from "@/components/admin-console";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatDualPrice } from "@/lib/currency";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order operations" };

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; view?: string; search?: string; status?: string }>;
}) {
  const query = await searchParams;
  const view = query.view === "keys" ? "keys" : "services";
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all");
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase.from("uniplug_member_orders").select("id,order_number,customer_email,customer_phone,total_kes,payment_status,fulfillment_status,paystack_channel,paid_at,created_at").order("created_at", { ascending: false }).limit(200)
    : { data: [] };
  const orders = (data || []) as Array<{ id: string; order_number: string; customer_email: string; customer_phone: string; total_kes: number; payment_status: string; fulfillment_status: string; paystack_channel: string | null; paid_at: string | null; created_at: string }>;
  const admin = createAdminSupabaseClient();
  const { data: keyOrderData } = admin ? await admin.from("uniplug_key_orders").select("id,product_name,licence_term,amount_kes,customer_email,customer_phone,payment_status,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(200) : { data: [] };
  const keyOrders = (keyOrderData || []) as Array<{ id: string; product_name: string; licence_term: string; amount_kes: number; customer_email: string; customer_phone: string; payment_status: string; fulfillment_status: string; created_at: string }>;
  const ready = orders.filter((order) => order.payment_status === "paid" && !["active", "completed"].includes(order.fulfillment_status));
  const keysToDeliver = keyOrders.filter((order) => order.payment_status === "paid" && order.fulfillment_status !== "delivered");

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = !search || `${order.order_number} ${order.customer_email} ${order.customer_phone || ""}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || order.payment_status === status || order.fulfillment_status === status;
    return matchesSearch && matchesStatus;
  });
  const filteredKeys = keyOrders.filter((order) => {
    const matchesSearch = !search || `${order.product_name} ${order.customer_email} ${order.customer_phone || ""}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || order.payment_status === status || order.fulfillment_status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="portal-page">
      <AdminPageHeader eyebrow="Orders" title="Order operations" description="Keep subscription fulfilment and software-key delivery separate so only one queue is visible at a time." />
      {query.success ? <p className="admin-notice">{query.success === "key_delivered" ? "Software key marked as delivered." : "Order activation completed."}</p> : null}

      <AdminMetricStrip items={[
        { label: "Service orders", value: orders.length, detail: "most recent 200" },
        { label: "Needs activation", value: ready.length, detail: "paid and waiting", tone: ready.length ? "warning" : "good" },
        { label: "Key orders", value: keyOrders.length, detail: "software store" },
        { label: "Keys to deliver", value: keysToDeliver.length, detail: "paid and waiting", tone: keysToDeliver.length ? "warning" : "good" }
      ]} />

      <AdminTabs active={view === "keys" ? "/admin/orders?view=keys" : "/admin/orders"} tabs={[
        { label: "Service orders", href: "/admin/orders", count: orders.length },
        { label: "Software keys", href: "/admin/orders?view=keys", count: keyOrders.length }
      ]} />

      <AdminToolbar>
        <form method="get">
          {view === "keys" ? <input type="hidden" name="view" value="keys" /> : null}
          <input className="admin-search" type="search" name="search" defaultValue={query.search || ""} placeholder={view === "keys" ? "Search product, email or phone…" : "Search order, email or phone…"} />
          <select name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option><option value="delivered">Delivered</option><option value="failed">Failed</option>
          </select>
          <button className="button button-light" type="submit">Filter</button>
        </form>
      </AdminToolbar>

      {view === "services" ? (
        <AdminSection title="Service order queue" description={`${filteredOrders.length} matching order${filteredOrders.length === 1 ? "" : "s"}`}>
          {filteredOrders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Total</th><th>Action</th></tr></thead><tbody>{filteredOrders.map((order) => {
            const canActivate = order.payment_status === "paid" && !["active", "completed"].includes(order.fulfillment_status);
            return <tr key={order.id}><td><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></td><td><strong>{order.customer_email}</strong><small>{order.customer_phone || "No phone"}</small></td><td><AdminStatus value={order.payment_status} /><small>{order.paystack_channel || "Channel pending"}</small></td><td><AdminStatus value={order.fulfillment_status} /></td><td><strong>{formatDualPrice(Number(order.total_kes))}</strong></td><td>{canActivate ? <form action={activateMemberOrder}><input name="orderId" type="hidden" value={order.id} /><ConfirmSubmitButton className="button button-dark small" confirmation={`Activate paid order ${order.order_number}? Confirm the service is ready before continuing.`}>Activate</ConfirmSubmitButton></form> : <span className="admin-row-subtext">No action needed</span>}</td></tr>;
          })}</tbody></table></div> : <AdminEmptyState title="No service orders match" description="Clear the filters or wait for new member purchases." />}
        </AdminSection>
      ) : (
        <AdminSection title="Software key orders" description={`${filteredKeys.length} matching order${filteredKeys.length === 1 ? "" : "s"}`}>
          {filteredKeys.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Total</th><th>Action</th></tr></thead><tbody>{filteredKeys.map((order) => {
            const canDeliver = order.payment_status === "paid" && order.fulfillment_status !== "delivered";
            return <tr key={order.id}><td><strong>{order.product_name}</strong><small>{order.licence_term} licence · {new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></td><td><strong>{order.customer_email}</strong><small>{order.customer_phone || "No phone"}</small></td><td><AdminStatus value={order.payment_status} /></td><td><AdminStatus value={order.fulfillment_status} /></td><td><strong>KSh {Number(order.amount_kes).toLocaleString("en-KE")}</strong></td><td>{canDeliver ? <form action={markKeyOrderDelivered}><input name="orderId" type="hidden" value={order.id} /><ConfirmSubmitButton className="button button-dark small" confirmation={`Confirm the ${order.product_name} key was sent to ${order.customer_email}?`}>Mark delivered</ConfirmSubmitButton></form> : <span className="admin-row-subtext">Delivered</span>}</td></tr>;
          })}</tbody></table></div> : <AdminEmptyState title="No key orders match" description="Clear the filters or wait for new software-key purchases." />}
        </AdminSection>
      )}
    </section>
  );
}
