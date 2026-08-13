"use client";

import Link from "next/link";
import { useState } from "react";
import { KEY_PRODUCTS, type KeyProductSlug } from "@/lib/key-products";

const money = new Intl.NumberFormat("en-KE");

export function KeyStoreHome() {
  return (
    <div className="key-store">
      <section className="key-hero">
        <div className="key-shell key-hero-grid">
          <div>
            <p className="key-kicker">Software keys. No clutter.</p>
            <h1>Get activated.<br /><span>Get to work.</span></h1>
            <p className="key-lede">Straightforward software licences, secure local payment, and real activation support from UniPlug.</p>
            <a className="key-button key-button-primary" href="#keys">Shop keys</a>
          </div>
          <div className="key-hero-card" aria-label="UniPlug promise">
            <span className="key-spark">✦</span>
            <strong>Digital delivery</strong>
            <p>Your key and activation instructions are prepared after payment confirmation.</p>
            <div><span>Secure checkout</span><span>Kenyan support</span></div>
          </div>
        </div>
      </section>
      <section className="key-products key-shell" id="keys" aria-labelledby="keys-title">
        <div className="key-section-heading">
          <div><p className="key-kicker">The key shelf</p><h2 id="keys-title">Two essentials. Fair prices.</h2></div>
          <p>No bundles, mystery tiers, or confusing comparisons.</p>
        </div>
        <div className="key-product-grid">
          {Object.values(KEY_PRODUCTS).map((product, index) => (
            <article className={`key-product key-product-${index + 1}`} key={product.slug}>
              <div className="key-product-top"><span>{product.badge}</span><b>{index === 0 ? "A" : "11"}</b></div>
              <h3>{product.name}</h3><p>{product.description}</p>
              <ul>{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <div className="key-price"><strong>KSh {money.format(product.priceKes)}</strong><span>/{product.term}</span></div>
              <Link className="key-button key-button-dark" href={`/checkout?product=${product.slug}`}>Buy key <span>→</span></Link>
            </article>
          ))}
        </div>
      </section>
      <section className="key-how"><div className="key-shell"><p className="key-kicker">How it works</p><div className="key-steps"><article><b>01</b><h3>Pick your key</h3><p>Choose the software licence that fits your device.</p></article><article><b>02</b><h3>Pay securely</h3><p>Complete payment through our secure Paystack checkout.</p></article><article><b>03</b><h3>Activate</h3><p>We prepare your key and clear activation instructions.</p></article></div></div></section>
    </div>
  );
}

export function KeyCheckout({ initialProduct }: { initialProduct: KeyProductSlug }) {
  const [productSlug, setProductSlug] = useState<KeyProductSlug>(initialProduct);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product = KEY_PRODUCTS[productSlug];

  async function pay(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/keys/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product: productSlug, email, phone }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || "Checkout could not start");
      window.location.assign(body.authorizationUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Checkout could not start"); setBusy(false); }
  }

  return <section className="key-checkout key-shell"><Link className="key-back" href="/">← Back to keys</Link><div className="key-checkout-grid"><form className="key-checkout-form" onSubmit={pay}><p className="key-kicker">Secure checkout</p><h1>Where should we send your key?</h1><label>Software<select value={productSlug} onChange={(e) => setProductSlug(e.target.value as KeyProductSlug)}>{Object.values(KEY_PRODUCTS).map((item) => <option value={item.slug} key={item.slug}>{item.name} — KSh {money.format(item.priceKes)}/{item.term}</option>)}</select></label><label>Email address<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Phone / WhatsApp<input required inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></label><p className="key-form-note">We use these details only for your order, delivery, and support.</p>{error ? <p className="key-error" role="alert">{error}</p> : null}<button className="key-button key-button-primary" disabled={busy || phone.replace(/\D/g, "").length < 9} type="submit">{busy ? "Opening secure payment…" : `Pay KSh ${money.format(product.priceKes)}`}</button></form><aside className="key-order-card"><span>{product.badge}</span><div className="key-order-icon">{product.slug === "adobe-acrobat" ? "A" : "11"}</div><h2>{product.name}</h2><p>{product.description}</p><div className="key-order-total"><span>Total</span><strong>KSh {money.format(product.priceKes)}</strong></div><small>One {product.term} licence · Digital fulfilment after payment</small></aside></div></section>;
}

export function KeyStoreHeader() { return <header className="key-header"><div className="key-shell"><Link className="key-brand" href="/"><span>u</span>uniplug</Link><nav><Link href="/#keys">Keys</Link><Link href="mailto:support@uniplug.shop">Support</Link></nav><Link className="key-button key-button-small" href="/checkout?product=adobe-acrobat">Buy a key</Link></div></header>; }
export function KeyStoreFooter() { return <footer className="key-footer"><div className="key-shell"><div><span className="key-brand"><span>u</span>uniplug</span><p>Software keys, simply delivered.</p></div><p>© 2026 UniPlug Kenya</p></div></footer>; }
