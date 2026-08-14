"use client";

import Link from "next/link";
import { useState } from "react";

type RequestResult = { reference: string } | null;
type OrderResult = {
  reference: string;
  productName: string;
  licenceTerm: string;
  amountKes: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
} | null;

const money = new Intl.NumberFormat("en-KE");
const readable = (value: string) => value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

export function RequestKeyForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RequestResult>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/keys/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form))
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.reference) throw new Error(body.error || "The request could not be saved");
      setResult({ reference: body.reference });
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be saved");
    } finally {
      setBusy(false);
    }
  }

  if (result) return (
    <div className="key-request-confirmation" role="status">
      <span aria-hidden="true">✓</span>
      <div>
        <p className="key-kicker">Request saved</p>
        <h2>We have your software request.</h2>
        <p>Keep reference <strong>{result.reference}</strong>. UniPlug can use it to identify your request.</p>
        <p>No availability, price, delivery time, or licence terms are promised until UniPlug confirms them directly.</p>
        <button className="key-button key-button-outline" onClick={() => setResult(null)} type="button">Request another key</button>
      </div>
    </div>
  );

  return (
    <form className="key-request-form" onSubmit={submit}>
      <div className="key-request-form-heading">
        <div><p className="key-kicker">Can’t find your software?</p><h2>Tell us what you need.</h2></div>
        <p>We’ll confirm availability, price, and licence conditions before you pay.</p>
      </div>
      <div className="key-request-fields">
        <label>Software name<input autoComplete="off" maxLength={120} minLength={2} name="softwareName" placeholder="e.g. Microsoft Visio" required /></label>
        <label>Platform<select defaultValue="" name="platform" required><option disabled value="">Choose platform</option><option>Windows</option><option>macOS</option><option>Android</option><option>iOS / iPadOS</option><option>Linux</option><option>Web / browser</option><option>Other</option></select></label>
        <label>Email address<input autoComplete="email" maxLength={254} name="email" placeholder="you@example.com" required type="email" /></label>
        <label>Phone / WhatsApp<input autoComplete="tel" inputMode="tel" maxLength={20} name="phone" placeholder="0712 345 678" required /></label>
        <label className="key-honeypot" aria-hidden="true">Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
      </div>
      <div className="key-request-submit-row">
        <p className="key-form-note">Never include passwords, payment credentials, activation codes, or one-time codes.</p>
        <button className="key-button key-button-lime" disabled={busy} type="submit">{busy ? "Saving request…" : "Request software"}</button>
      </div>
      {error ? <p className="key-error" role="alert">{error}</p> : null}
    </form>
  );
}

export function KeyOrderLookup({ initialReference = "" }: { initialReference?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/keys/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form))
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The order could not be found");
      setOrder(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The order could not be found");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="key-order-lookup key-shell" aria-labelledby="key-order-lookup-title">
      <div className="key-order-lookup-intro">
        <p className="key-kicker">Order lookup</p>
        <h1 id="key-order-lookup-title">Check a software-key order.</h1>
        <p>Enter the Paystack order reference and the same email used at checkout. No software key or private activation data is displayed here.</p>
      </div>
      <form onSubmit={submit}>
        <label>Order reference<input autoCapitalize="characters" autoComplete="off" defaultValue={initialReference} name="reference" placeholder="KEY-…" required /></label>
        <label>Order email<input autoComplete="email" name="email" placeholder="you@example.com" required type="email" /></label>
        {error ? <p className="key-error" role="alert">{error}</p> : null}
        <button className="key-button key-button-dark" disabled={busy} type="submit">{busy ? "Checking order…" : "Check order"}</button>
      </form>
      {order ? (
        <article className="key-order-result" aria-live="polite">
          <div><p className="key-kicker">Order found</p><h2>{order.productName}</h2><code>{order.reference}</code></div>
          <dl>
            <div><dt>Payment</dt><dd>{readable(order.paymentStatus)}</dd></div>
            <div><dt>Fulfilment</dt><dd>{readable(order.fulfillmentStatus)}</dd></div>
            <div><dt>Licence term</dt><dd>{order.licenceTerm}</dd></div>
            <div><dt>Amount</dt><dd>KSh {money.format(order.amountKes)}</dd></div>
            <div><dt>Ordered</dt><dd>{new Date(order.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
          </dl>
          <p>If the status does not match what you expect, email <a href={`mailto:support@uniplug.shop?subject=${encodeURIComponent(`Order ${order.reference}`)}`}>support@uniplug.shop</a> and include the reference above.</p>
        </article>
      ) : null}
      <p className="key-order-lookup-back"><Link href="/">← Back to software keys</Link></p>
    </section>
  );
}
