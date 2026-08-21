import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceArtwork } from "@/components/service-artwork";
import { requireMember } from "@/lib/auth";
import { formatDualPrice } from "@/lib/currency";
import { formatMemberDateTime, memberStatusClass, memberStatusLabel } from "@/lib/member-dashboard";
import { planDurationLabel } from "@/lib/plan-durations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("uniplug_member_orders")
      .select("id,order_number,customer_email,customer_phone,subtotal_kes,total_kes,currency,payment_status,fulfillment_status,paystack_reference,paystack_channel,paid_at,created_at,updated_at")
      .eq("id", id)
      .eq("user_id", viewer.user.id)
      .maybeSingle(),
    supabase
      .from("uniplug_member_order_items")
      .select("id,service_name,plan_name,billing_cycle,duration_months,unit_price_kes,service:uniplug_catalog_services(slug,logo_text,accent_color)")
      .eq("order_id", id)
      .order("created_at")
  ]);
  const order = orderResult.data;
  if (!order) notFound();

  const orderItems = (itemsResult.data || []) as unknown as Array<{
    id: string;
    service_name: string;
    plan_name: string;
    billing_cycle: string;
    duration_months: number;
    unit_price_kes: number;
    service: { slug: string; logo_text: string; accent_color: string } | null;
  }>;

  const paymentFailed = ["failed", "initialization_failed", "amount_mismatch"].includes(order.payment_status);
  const paymentComplete = ["paid", "refunded"].includes(order.payment_status);
  const underReview = order.fulfillment_status === "manual_review";
  const activationStarted = ["pending_activation", "processing", "active", "completed", "manual_review", "refunded"].includes(order.fulfillment_status);
  const serviceComplete = ["active", "completed"].includes(order.fulfillment_status);
  const stopped = ["cancelled", "refunded"].includes(order.fulfillment_status);
  const stages = [
    { key: "created", label: "Order created", complete: true },
    { key: "payment", label: paymentFailed ? memberStatusLabel(order.payment_status) : "Payment confirmed", complete: paymentComplete },
    { key: "activation", label: underReview ? "Order under review" : "Activation started", complete: activationStarted && !underReview },
    { key: "complete", label: stopped ? memberStatusLabel(order.fulfillment_status) : "Service active", complete: serviceComplete }
  ];

  return (
    <section className="section shell page-top">
      <Link className="back-link" href="/dashboard/orders">← Back to order history</Link>
      {paymentFailed ? <p className="form-error page-notice">{memberStatusLabel(order.payment_status)}. Open the payment summary below or create a support ticket if you need help.</p> : null}
      {underReview ? <p className="form-success page-notice">This order is under review before activation can continue.</p> : null}
      {itemsResult.error ? <p className="form-error page-notice">Some order item details could not be loaded.</p> : null}
      <div className="order-detail-grid">
        <div>
          <div className="page-heading order-heading">
            <p className="eyebrow">Order receipt</p>
            <h1>{order.order_number}</h1>
            <p>Placed {formatMemberDateTime(order.created_at)}</p>
          </div>

          <section className="panel">
            <div className="section-heading compact"><div><p className="eyebrow">Services</p><h2>Order items</h2></div></div>
            <div className="order-item-list">
              {orderItems.map((item) => (
                <article key={item.id}>
                  <ServiceArtwork
                    accentColor={item.service?.accent_color || "#6957ff"}
                    className="service-logo small"
                    logoText={item.service?.logo_text || "UP"}
                    name={item.service_name}
                    slug={item.service?.slug}
                  />
                  <div><strong>{item.service_name}</strong><span>{item.plan_name} · {planDurationLabel(Number(item.duration_months))}</span></div>
                  <strong>{formatDualPrice(Number(item.unit_price_kes))}</strong>
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
          <div className="receipt-total"><span>Total</span><strong>{formatDualPrice(Number(order.total_kes))}</strong></div>
          <p className="muted-copy">Your receipt shows the final dollar total for this order.</p>
          <dl>
            <div><dt>Payment</dt><dd><span className={memberStatusClass(order.payment_status)}>{memberStatusLabel(order.payment_status)}</span></dd></div>
            <div><dt>Fulfilment</dt><dd><span className={memberStatusClass(order.fulfillment_status)}>{memberStatusLabel(order.fulfillment_status)}</span></dd></div>
            <div><dt>Channel</dt><dd>{order.paystack_channel || "Pending"}</dd></div>
            <div><dt>Paid at</dt><dd>{order.paid_at ? formatMemberDateTime(order.paid_at) : "Not paid"}</dd></div>
            <div><dt>Account</dt><dd>{order.customer_email}</dd></div>
            <div><dt>Phone</dt><dd>{order.customer_phone}</dd></div>
          </dl>
          {order.paystack_reference ? <div className="reference-box"><span>Payment reference</span><code>{order.paystack_reference}</code></div> : null}
          <p className="muted-copy">Need help with a payment? Share the order number with UniPlug support. Never share your password.</p>
          <Link className="button button-dark" href={`/dashboard/support?service=${encodeURIComponent(orderItems[0]?.service_name || "Order")}`}>Create support ticket</Link>
        </aside>
      </div>
    </section>
  );
}
