"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/catalog";

function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

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
        body: JSON.stringify({ phone, planIds: items.map((item) => item.planId) })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || "Checkout could not start");
      window.location.assign(body.authorizationUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not start");
      setBusy(false);
    }
  }

  if (!items.length) return <div className="empty-state"><h2>Your cart is empty</h2><p>Add a member plan from a service detail page.</p><a className="button button-dark" href="/services">Browse services</a></div>;

  return (
    <div className="checkout-grid">
      <section className="panel">
        <p className="eyebrow">Secure checkout</p><h1>Confirm your services</h1><p>Signed in as {email}</p>
        <div className="checkout-items">
          {items.map((item) => <div className="checkout-item" key={item.planId}><div><strong>{item.serviceName}</strong><span>{item.planName} · {item.billingCycle}</span></div><strong>{formatKes(item.priceKes)}</strong><button type="button" onClick={() => remove(item.planId)}>Remove</button></div>)}
        </div>
        <label className="field">Phone / WhatsApp<input inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07…" /></label>
      </section>
      <aside className="summary-card"><p className="eyebrow">Order summary</p><div><span>{items.length} service{items.length === 1 ? "" : "s"}</span><strong>{formatKes(displayedTotal)}</strong></div><p>The final amount is recalculated securely from the database before payment.</p>{error && <p className="form-error">{error}</p>}<button type="button" className="button button-mint" disabled={busy || phone.replace(/\D/g, "").length < 9} onClick={pay}>{busy ? "Starting payment…" : "Pay securely"}</button></aside>
    </div>
  );
}

export function PaymentStatus({ reference }: { reference: string | null }) {
  const { clear } = useCart();
  const [state, setState] = useState<"checking" | "paid" | "failed">("checking");
  const [message, setMessage] = useState("Confirming your payment…");

  useEffect(() => {
    if (!reference) { setState("failed"); setMessage("The payment reference is missing."); return; }
    const controller = new AbortController();
    fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (ok && body.paid) { clear(); setState("paid"); setMessage("Payment confirmed. Your service will appear in the dashboard as activation begins."); }
        else { setState("failed"); setMessage(body.error || "Payment could not be confirmed."); }
      })
      .catch((error) => { if (error.name !== "AbortError") { setState("failed"); setMessage("Payment verification failed. Please contact support if you were charged."); } });
    return () => controller.abort();
  }, [reference, clear]);

  return <div className={`payment-status ${state}`}><div className="status-icon">{state === "checking" ? "…" : state === "paid" ? "✓" : "!"}</div><h1>{state === "checking" ? "Confirming payment" : state === "paid" ? "You’re plugged in" : "Payment not confirmed"}</h1><p>{message}</p><a className="button button-dark" href={state === "paid" ? "/dashboard" : "/services"}>{state === "paid" ? "Open dashboard" : "Back to services"}</a></div>;
}
