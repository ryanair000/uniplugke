import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase
      .from("uniplug_member_orders")
      .select("id,order_number,customer_email,customer_phone,subtotal_kes,total_kes,currency,payment_status,fulfillment_status,paystack_reference,paystack_channel,paid_at,created_at,updated_at")
      .eq("id", id)
      .eq("user_id", viewer.user.id)
      .maybeSingle(),
    supabase
      .from("uniplug_member_order_items")
      .select("id,service_name,plan_name,billing_cycle,unit_price_kes,service:uniplug_catalog_services(slug,logo_text,accent_color)")
      .eq("order_id", id)
      .order("created_at")
  ]);
  if (!order) notFound();

  const orderItems = (items || []) as unknown as Array<{
    id: string;
    service_name: string;
    plan_name: string;
    billing_cycle: string;
    unit_price_kes: number;
    service: { slug: string; logo_text: string; accent_color: string } | null;
  }>;

  const stages = [
    { key: "created", label: "Order created", complete: true },
    { key: "payment", label: "Payment confirmed", complete: order.payment_status === "paid" },
    { key: "activation", label: "Activation started", complete: ["pending_activation", "processing", "active", "completed"].includes(order.fulfillment_status) },
    { key: "complete", label: "Service active", complete: ["active", "completed"].includes(order.fulfillment_status) }
  ];

  return (
    <section className="section shell page-top">
      <Link className="back-link" href="/dashboard/orders">← Back to order history</Link>
      <div className="order-detail-grid">
        <div>
          <div className="page-heading order-heading">
            <p className="eyebrow">Order receipt</p>
            <h1>{order.order_number}</h1>
            <p>Placed {new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short" })}</p>
          </div>

          <section className="panel">
            <div className="section-heading compact"><div><p className="eyebrow">Services</p><h2>Order items</h2></div></div>
            <div className="order-item-list">
              {orderItems.map((item) => (
                <article key={item.id}>
                  <div className="service-logo small" style={{ background: item.service?.accent_color || "#6957ff" }}>{item.service?.logo_text || "UP"}</div>
                  <div><strong>{item.service_name}</strong><span>{item.plan_name} · {readableStatus(item.billing_cycle)}</span></div>
                  <strong>{formatKes(Number(item.unit_price_kes))}</strong>
                  {item.service?.slug ? <Link href={`/services/${item.service.slug}`}>View service</Link> : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel order-progress-panel">
            <div className="section-heading compact"><div><p className="eyebrow">Progress</p><h2>Order timeline</h2></div></div>
            <div className="order-timeline">
              {stages.map((stage) => <div className={stage.complete ? "complete" : ""} key={stage.key}><span>{stage.complete ? "✓" : ""}</span><strong>{stage.label}</strong></div>)}
            </div>
          </section>
        </div>

        <aside className="panel receipt-summary">
          <p className="eyebrow">Payment summary</p>
          <div className="receipt-total"><span>Total</span><strong>{formatKes(Number(order.total_kes))}</strong></div>
          <dl>
            <div><dt>Payment</dt><dd>{readableStatus(order.payment_status)}</dd></div>
            <div><dt>Fulfilment</dt><dd>{readableStatus(order.fulfillment_status)}</dd></div>
            <div><dt>Channel</dt><dd>{order.paystack_channel || "Pending"}</dd></div>
            <div><dt>Paid at</dt><dd>{order.paid_at ? new Date(order.paid_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "Not paid"}</dd></div>
            <div><dt>Account</dt><dd>{order.customer_email}</dd></div>
            <div><dt>Phone</dt><dd>{order.customer_phone}</dd></div>
          </dl>
          {order.paystack_reference ? <div className="reference-box"><span>Payment reference</span><code>{order.paystack_reference}</code></div> : null}
          <p className="muted-copy">Need help with a payment? Share the order number with UniPlug support. Never share your password.</p>
          <a className="button button-dark" href={`https://wa.me/254113033475?text=${encodeURIComponent(`Hello UniPlug, I need help with order ${order.order_number}.`)}`}>Contact support</a>
        </aside>
      </div>
    </section>
  );
}
