"use client";

import { useState } from "react";

function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function RenewalCheckout({
  subscriptionId,
  serviceName,
  planName,
  billingCycle,
  priceKes,
  email,
  defaultPhone
}: {
  subscriptionId: string;
  serviceName: string;
  planName: string;
  billingCycle: string;
  priceKes: number;
  email: string;
  defaultPhone: string;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startRenewal() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, phone })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || "Renewal checkout could not start");
      window.location.assign(body.authorizationUrl);
    } catch (renewalError) {
      setError(renewalError instanceof Error ? renewalError.message : "Renewal checkout could not start");
      setBusy(false);
    }
  }

  return (
    <div className="checkout-grid">
      <section className="panel">
        <p className="eyebrow">Subscription renewal</p>
        <h1>Extend {serviceName}</h1>
        <p>Signed in as {email}. The renewal is applied to your existing subscription after payment and activation.</p>
        <div className="checkout-items">
          <div className="checkout-item renewal-line">
            <div><strong>{serviceName}</strong><span>{planName} · {billingCycle}</span></div>
            <strong>{formatKes(priceKes)}</strong>
          </div>
        </div>
        <label className="field">Phone / WhatsApp<input inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07…" /></label>
      </section>
      <aside className="summary-card">
        <p className="eyebrow">Renewal summary</p>
        <div><span>One service period</span><strong>{formatKes(priceKes)}</strong></div>
        <p>The final amount and plan eligibility are recalculated securely from the private database before Paystack opens.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="button" className="button button-mint" disabled={busy || phone.replace(/\D/g, "").length < 9} onClick={startRenewal}>{busy ? "Starting renewal…" : "Pay renewal securely"}</button>
      </aside>
    </div>
  );
}
