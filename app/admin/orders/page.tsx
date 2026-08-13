import { activateMemberOrder, markKeyOrderDelivered } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatDualPrice } from "@/lib/currency";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order operations" };

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase
        .from("uniplug_member_orders")
        .select("id,order_number,customer_email,customer_phone,total_kes,payment_status,fulfillment_status,paystack_channel,paid_at,created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const orders = (data || []) as Array<{
    id: string;
    order_number: string;
    customer_email: string;
    customer_phone: string;
    total_kes: number;
    payment_status: string;
    fulfillment_status: string;
    paystack_channel: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  const ready = orders.filter((order) =>
    order.payment_status === "paid" && !["active", "completed"].includes(order.fulfillment_status)
  );
  const admin = createAdminSupabaseClient();
  const { data: keyOrderData } = admin ? await admin.from("uniplug_key_orders").select("id,product_name,licence_term,amount_kes,customer_email,customer_phone,payment_status,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(100) : { data: [] };
  const keyOrders = (keyOrderData || []) as Array<{ id: string; product_name: string; licence_term: string; amount_kes: number; customer_email: string; customer_phone: string; payment_status: string; fulfillment_status: string; created_at: string }>;

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">Revenue operations</p><h1>Orders</h1><p>Review payment state and activate paid services without losing the customer context.</p></div>
      </div>
      {query.success ? <p className="form-success page-notice">{query.success === "key_delivered" ? "Software key order marked as delivered." : "Order activation completed."}</p> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>All orders</span><strong>{orders.length}</strong><small>Most recent 100</small></article>
        <article><span>Paid</span><strong>{orders.filter((order) => order.payment_status === "paid").length}</strong><small>Payment confirmed</small></article>
        <article><span>Needs activation</span><strong>{ready.length}</strong><small>Ready for fulfilment</small></article>
      </div>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Fulfilment</p><h2>Order queue</h2></div></div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Total</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {orders.map((order) => {
                const canActivate = order.payment_status === "paid" && !["active", "completed"].includes(order.fulfillment_status);
                return (
                  <tr key={order.id}>
                    <td><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></td>
                    <td><strong>{order.customer_email}</strong><small>{order.customer_phone}</small></td>
                    <td><span className={`status-pill status-${order.payment_status}`}>{readableStatus(order.payment_status)}</span><small>{order.paystack_channel || "Channel pending"}</small></td>
                    <td><span className={`status-pill subtle status-${order.fulfillment_status}`}>{readableStatus(order.fulfillment_status)}</span></td>
                    <td><strong>{formatDualPrice(Number(order.total_kes))}</strong></td>
                    <td>
                      {canActivate ? (
                        <form action={activateMemberOrder}>
                          <input name="orderId" type="hidden" value={order.id} />
                          <ConfirmSubmitButton
                            className="button button-dark small"
                            confirmation={`Activate paid order ${order.order_number}? Confirm the service is ready before continuing.`}
                          >
                            Activate
                          </ConfirmSubmitButton>
                        </form>
                      ) : <span className="table-complete">Complete</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!orders.length ? <div className="empty-state"><h3>No orders yet</h3><p>New member purchases will appear here.</p></div> : null}
      </section>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Public key store</p><h2>Software key orders</h2></div></div>
        <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Product</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Total</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{keyOrders.map((order) => {
          const canDeliver = order.payment_status === "paid" && order.fulfillment_status !== "delivered";
          return <tr key={order.id}><td><strong>{order.product_name}</strong><small>{order.licence_term} licence · {new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small></td><td><strong>{order.customer_email}</strong><small>{order.customer_phone}</small></td><td><span className={`status-pill status-${order.payment_status}`}>{readableStatus(order.payment_status)}</span></td><td><span className={`status-pill subtle status-${order.fulfillment_status}`}>{readableStatus(order.fulfillment_status)}</span></td><td><strong>KSh {Number(order.amount_kes).toLocaleString("en-KE")}</strong></td><td>{canDeliver ? <form action={markKeyOrderDelivered}><input name="orderId" type="hidden" value={order.id} /><ConfirmSubmitButton className="button button-dark small" confirmation={`Confirm the ${order.product_name} key was sent to ${order.customer_email}?`}>Mark delivered</ConfirmSubmitButton></form> : <span className="table-complete">{order.fulfillment_status === "delivered" ? "Delivered" : "Waiting"}</span>}</td></tr>;
        })}</tbody></table></div>
        {!keyOrders.length ? <div className="empty-state"><h3>No key orders yet</h3><p>Paid software-key purchases will appear here.</p></div> : null}
      </section>
    </section>
  );
}
