"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/catalog";
import { formatDualPrice } from "@/lib/currency";
import { planDurationLabel } from "@/lib/plan-durations";
import { clearStoreCart } from "@/lib/store-cart";

export function CheckoutClient({ email }: { email: string }) {
  const { items, remove } = useCart();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const displayedTotal = items.reduce((sum, item) => sum + item.priceKes, 0);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          selections: items.map((item) => ({
            planId: item.planId,
            durationMonths: item.durationMonths
          }))
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || "Checkout could not start");
      window.location.assign(body.authorizationUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not start");
      setBusy(false);
    }
  }

  if (!items.length) return <div className="empty-state"><h2>Your cart is empty</h2><p>Add a member plan from a service detail page.</p><Link className="button button-dark" href="/services">Browse services</Link></div>;

  return (
    <div className="checkout-grid">
      <section className="panel">
        <p className="eyebrow">Secure checkout</p><h1>Confirm your services</h1><p>Signed in as {email}</p>
        <div className="checkout-items">
          {items.map((item) => <div className="checkout-item" key={item.planId}><div><strong>{item.serviceName}</strong><span>{item.planName} · {planDurationLabel(item.durationMonths)} · {formatDualPrice(item.monthlyPriceKes)}/month</span></div><strong>{formatDualPrice(item.priceKes)}</strong><button type="button" onClick={() => remove(item.planId)}>Remove</button></div>)}
        </div>
        <label className="field">Phone / WhatsApp<input inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07…" /></label>
      </section>
      <aside className="summary-card"><p className="eyebrow">Order summary</p><div><span>{items.length} service{items.length === 1 ? "" : "s"}</span><strong>{formatDualPrice(displayedTotal)}</strong></div><p>The final KSh amount and plan eligibility are recalculated securely before payment.</p>{error && <p className="form-error">{error}</p>}<button type="button" className="button button-mint" disabled={busy || phone.replace(/\D/g, "").length < 9} onClick={pay}>{busy ? "Starting payment…" : "Pay securely"}</button></aside>
    </div>
  );
}

type PaymentStatusKind = "member" | "key" | "store";

function PaymentStatusView({ reference, orderKind, clear }: { reference: string | null; orderKind: PaymentStatusKind; clear?: () => void }) {
  const [state, setState] = useState<"checking" | "paid" | "pending" | "failed">(reference ? "checking" : "failed");
  const [message, setMessage] = useState(reference ? "Confirming your payment…" : "The payment reference is missing.");

  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (ok && body.paid) {
          clear?.();
          setState("paid");
          setMessage(orderKind === "key"
            ? "Payment confirmed. We are preparing your software key and activation instructions."
            : orderKind === "store"
              ? "Payment confirmed. Your physical order is now being prepared for delivery."
              : "Payment confirmed. Your order is now waiting for service activation or renewal processing.");
        }
        else if (body.state === "pending") { setState("pending"); setMessage(body.error || "Payment is still pending confirmation. Do not pay again yet."); }
        else { setState("failed"); setMessage(body.error || "Payment could not be confirmed."); }
      })
      .catch((error) => { if (error.name !== "AbortError") { setState("failed"); setMessage("Payment verification failed. Please contact support if you were charged."); } });
    return () => controller.abort();
  }, [reference, clear, orderKind]);

  const publicOrder = orderKind !== "member";
  const destination = orderKind === "key" && reference ? `/order-status?reference=${encodeURIComponent(reference)}` : orderKind === "store" ? "/" : orderKind === "key" ? "/" : state === "paid" ? "/dashboard" : "/services";
  const label = orderKind === "key" && reference ? "Check order status" : orderKind === "store" ? "Continue shopping" : orderKind === "key" ? "Back to key store" : state === "paid" ? "Open dashboard" : "Back to services";
  const title = state === "checking" ? "Confirming payment" : state === "paid" ? "Payment confirmed" : state === "pending" ? "Payment pending" : "Payment not confirmed";
  return <div className={`payment-status ${state} ${publicOrder ? "key-payment-status" : ""}`}><div className="status-icon">{state === "checking" ? "…" : state === "paid" ? "✓" : state === "pending" ? "⌛" : "!"}</div><h1>{title}</h1><p>{message}</p>{publicOrder && reference ? <p className="payment-reference">Support reference <code>{reference}</code></p> : null}<div className="payment-status-actions"><Link className="button button-dark" href={destination}>{label}</Link>{publicOrder ? <a className="button button-light" href={`mailto:support@uniplug.shop?subject=${encodeURIComponent(`Payment ${reference || "reference missing"}`)}`}>Email support</a> : null}</div></div>;
}

function MemberPaymentStatus({ reference }: { reference: string | null }) {
  const { clear } = useCart();
  return <PaymentStatusView clear={clear} orderKind="member" reference={reference} />;
}

export function PaymentStatus({ reference, keyOrder = false, storeOrder = false }: { reference: string | null; keyOrder?: boolean; storeOrder?: boolean }) {
  return storeOrder
    ? <PaymentStatusView clear={clearStoreCart} orderKind="store" reference={reference} />
    : keyOrder
      ? <PaymentStatusView orderKind="key" reference={reference} />
    : <MemberPaymentStatus reference={reference} />;
}
