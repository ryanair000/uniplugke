"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Menu, Search, UserRound } from "lucide-react";
import {
  KEY_PRODUCTS,
  keyProductEndOfTermDisclosure,
  keyProductPaymentDisclosure,
  type KeyProduct,
  type KeyProductSlug
} from "@/lib/key-products";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { RequestKeyForm } from "@/components/key-support";
import { StoreCartIndicator } from "@/components/store-cart";

const money = new Intl.NumberFormat("en-KE");
const products = Object.values(KEY_PRODUCTS);

type CategoryFilter = "all" | KeyProduct["category"];

const steps = [
  { number: "01", title: "Review the licence", copy: "Check the edition, term, compatibility, and conditions on the product page." },
  { number: "02", title: "Pay securely", copy: "Enter your delivery details and complete one local Paystack checkout." },
  { number: "03", title: "Receive and activate", copy: "Use the supplied instructions, with activation help available if needed." }
];

const keyFaqs = [
  {
    question: "How do I choose the right licence?",
    answer: "Open the product page and review the edition, licence term, compatibility, device limits, and any conditions marked for confirmation. Contact support before payment if a material detail is not yet confirmed."
  },
  {
    question: "When will my software be delivered?",
    answer: "Delivery is digital. Keep the KEY reference shown after checkout and use Order status to follow payment and fulfilment. A guaranteed delivery window is only shown when UniPlug has confirmed one."
  },
  {
    question: "What should I do if activation fails?",
    answer: "Check the supplied activation instructions, then contact support with the KEY reference and the exact error message. Never send passwords, payment credentials, or one-time codes. Replacement eligibility is confirmed case by case until a published policy is supplied."
  },
  {
    question: "What happens if payment is still pending?",
    answer: "Do not pay again immediately. Keep the KEY reference and check Order status. If Paystack charged you but the order remains unconfirmed, email support@uniplug.shop with that reference."
  }
];

function ProductImage({ product, priority = false }: { product: KeyProduct; priority?: boolean }) {
  return (
    <div className={`key-product-art key-product-art-${product.slug}`}>
      <Image
        alt={product.imageAlt}
        fill
        priority={priority}
        sizes="(max-width: 700px) calc(100vw - 32px), (max-width: 1000px) 220px, 240px"
        src={product.image}
      />
    </div>
  );
}

function ProductFacts({ product }: { product: KeyProduct }) {
  return (
    <ul className="key-product-facts">
      {product.facts.map((fact) => (
        <li key={fact.label}><span aria-hidden="true">✓</span>{fact.value}</li>
      ))}
    </ul>
  );
}

function ProductScopeNotice({ product }: { product: KeyProduct }) {
  return (
    <p className="key-scope-notice">
      <strong>Confirm before payment:</strong> {product.pendingTerms.slice(0, 3).join(", ").toLowerCase()}.
    </p>
  );
}

function ProductCard({
  product,
  checkoutBase = "",
  priority = false
}: {
  product: KeyProduct;
  checkoutBase?: string;
  priority?: boolean;
}) {
  return (
    <article className="key-catalog-card">
      <ProductImage priority={priority} product={product} />
      <div className="key-catalog-card-body">
        <p className="key-card-category">{product.categoryLabel}</p>
        <h3><Link href={`${checkoutBase}/keys/${product.slug}`}>{product.name}</Link></h3>
        <p className="key-card-description">{product.description}</p>
        <dl className="key-card-specs">
          <div><dt>Licence term</dt><dd>{product.termLabel}</dd></div>
          <div><dt>Delivery</dt><dd>Digital</dd></div>
          <div><dt>Support</dt><dd>Activation help</dd></div>
        </dl>
        <p className="key-card-review-note"><strong>Review before checkout</strong> Compatibility and licence conditions are listed on the product page.</p>
        <div className="key-card-purchase">
          <div className="key-price">
            <strong>KSh {money.format(product.priceKes)}</strong>
            <span>for {product.termLabel}</span>
          </div>
          <div className="key-card-actions">
            <Link aria-label={`Review ${product.name} licence details`} className="key-button key-button-dark" href={`${checkoutBase}/keys/${product.slug}`}>
              View details <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function KeyShelf({ checkoutBase = "" }: { checkoutBase?: string }) {
  return (
    <section className="key-products key-shell key-vip-products" id="keys" aria-labelledby="keys-title">
      <div className="key-section-heading">
        <div>
          <p className="key-kicker">Software keys</p>
          <h2 id="keys-title">Essential software, clear pricing.</h2>
        </div>
        <p>Purchase through the keys store and receive delivery and activation guidance using your order details.</p>
      </div>
      <div className="key-product-grid">
        {products.map((product, index) => (
          <ProductCard checkoutBase={checkoutBase} key={product.slug} priority={index === 0} product={product} />
        ))}
      </div>
    </section>
  );
}

export function KeyStoreHome() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q")?.trim() || "";
    const initialCategory = new URLSearchParams(window.location.search).get("category");
    const initialQueryTimer = window.setTimeout(() => {
      if (initialQuery) setQuery(initialQuery);
      if (initialCategory === "pdf" || initialCategory === "operating-system") setCategory(initialCategory);
    }, 0);

    return () => {
      window.clearTimeout(initialQueryTimer);
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = products.filter((product) => {
      const searchable = `${product.name} ${product.categoryLabel} ${product.description}`.toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (category === "all" || product.category === category);
    });
    return matches;
  }, [category, query]);

  const updateCatalogUrl = (nextQuery: string, nextCategory: CategoryFilter) => {
    const parameters = new URLSearchParams();
    if (nextQuery.trim()) parameters.set("q", nextQuery.trim());
    if (nextCategory !== "all") parameters.set("category", nextCategory);
    const suffix = parameters.size ? `?${parameters.toString()}` : "";
    window.history.replaceState(null, "", `/${suffix}#catalog`);
  };

  const clearQuery = () => {
    setQuery("");
    updateCatalogUrl("", category);
  };

  const selectCategory = (nextCategory: CategoryFilter) => {
    setCategory(nextCategory);
    updateCatalogUrl(query, nextCategory);
  };

  const resetCatalog = () => {
    setQuery("");
    setCategory("all");
    updateCatalogUrl("", "all");
  };

  return (
    <div className="key-store">
      <section className="key-catalog key-shell" id="catalog" aria-labelledby="catalog-title">
        <div className="key-catalog-toolbar">
          <div>
            <p className="key-kicker">Available software</p>
            <h2 id="catalog-title">Choose the licence that fits.</h2>
            <p>Open a product to review its compatibility and licence conditions before checkout.</p>
          </div>
          <p aria-live="polite" className="key-result-count">{visibleProducts.length} {visibleProducts.length === 1 ? "listing" : "listings"}</p>
        </div>

        <div className="key-category-chips" aria-label="Product categories">
          <button className={category === "all" ? "is-active" : ""} onClick={() => selectCategory("all")} type="button">All keys</button>
          <button className={category === "pdf" ? "is-active" : ""} onClick={() => selectCategory("pdf")} type="button">PDF tools</button>
          <button className={category === "operating-system" ? "is-active" : ""} onClick={() => selectCategory("operating-system")} type="button">Windows</button>
        </div>

        <div className="key-catalog-results">
            {query ? (
              <div className="key-search-summary">
                <span>Results for “{query}”</span>
                <button onClick={clearQuery} type="button">Clear search</button>
              </div>
            ) : null}
            {visibleProducts.length ? visibleProducts.map((product, index) => (
              <ProductCard key={product.slug} priority={index === 0} product={product} />
            )) : (
              <div className="key-empty-state">
                <span aria-hidden="true">⌕</span>
                <h2>{query ? `No keys match “${query}”` : "No keys in this category"}</h2>
                <p>Try another search or ask us to source the software key you need.</p>
                <button className="key-button key-button-dark" onClick={resetCatalog} type="button">Show all keys</button>
              </div>
            )}
        </div>
      </section>

      <section className="key-request-section" id="support">
        <div className="key-shell"><RequestKeyForm /></div>
      </section>

      <section className="key-how" id="how-it-works" aria-labelledby="how-title">
        <div className="key-shell">
          <div className="key-how-heading"><div><p className="key-kicker">Simple from start to finish</p><h2 id="how-title">From licence review to activation.</h2></div><p>Three focused steps, with the material product conditions reviewed before payment.</p></div>
          <div className="key-steps">
            {steps.map((step) => (
              <article key={step.number}>
                <div><Image alt="" fill sizes="58px" src="/key-store/icon-07.svg" /><strong>{step.number}</strong></div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="key-faq key-shell" aria-labelledby="key-faq-title">
        <div className="key-faq-heading"><div><p className="key-kicker">Before and after payment</p><h2 id="key-faq-title">Questions worth checking.</h2></div><p>Short answers covering licence review, checkout, delivery, and activation support.</p></div>
        <div className="key-faq-list">
          {keyFaqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
        </div>
        <div className="key-faq-support"><p>Need order-specific help? Keep your <strong>KEY reference</strong>.</p><div><Link href="/order-status">Check order status</Link><a href="mailto:support@uniplug.shop">Email support</a></div></div>
      </section>

    </div>
  );
}

export function KeyCheckout({ initialProduct }: { initialProduct: KeyProductSlug }) {
  const [productSlug, setProductSlug] = useState<KeyProductSlug>(initialProduct);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const product = KEY_PRODUCTS[productSlug];

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/keys/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: productSlug, email, phone, termsAcknowledged })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || "Checkout could not start");
      window.location.assign(body.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not start");
      setBusy(false);
    }
  }

  return (
    <section className="key-checkout key-shell">
      <Link className="key-back" href="/">← Back to software keys</Link>
      <div className="key-checkout-grid">
        <form className="key-checkout-form" onSubmit={pay}>
          <p className="key-kicker">Secure checkout</p>
          <h1>Where should we send your key?</h1>
          <label>Software
            <select value={productSlug} onChange={(event) => setProductSlug(event.target.value as KeyProductSlug)}>
              {products.map((item) => <option value={item.slug} key={item.slug}>{item.name} — KSh {money.format(item.priceKes)} for {item.termLabel}</option>)}
            </select>
          </label>
          <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label>Phone / WhatsApp<input required inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0712 345 678" /></label>
          <p className="key-form-note">We use these details only for your order, digital delivery, and support.</p>
          <div className="key-checkout-disclosures">
            <h2>Material licence terms</h2>
            <p>{keyProductPaymentDisclosure(product)}</p>
            <p>{keyProductEndOfTermDisclosure(product)}</p>
            <p>Also confirm the exact edition or licence type, compatibility, device and activation count, region restrictions, delivery timing, and replacement/refund conditions before payment.</p>
          </div>
          <label className="key-terms-acknowledgement">
            <input checked={termsAcknowledged} onChange={(event) => setTermsAcknowledged(event.target.checked)} required type="checkbox" />
            <span>I have reviewed the confirmed terms and understand which material licence details still require confirmation before payment.</span>
          </label>
          {error ? <p className="key-error" role="alert">{error}</p> : null}
          <button className="key-button key-button-lime" disabled={busy || !termsAcknowledged || phone.replace(/\D/g, "").length < 9} type="submit">
            {busy ? "Opening secure payment…" : `Pay KSh ${money.format(product.priceKes)}`}
          </button>
        </form>
        <aside className="key-order-card">
          <ProductImage product={product} />
          <p className="key-card-category">{product.categoryLabel}</p>
          <h2>{product.name}</h2>
          <p>{product.description}</p>
          <ProductFacts product={product} />
          <ProductScopeNotice product={product} />
          <div className="key-order-total"><span>Total</span><strong>KSh {money.format(product.priceKes)}</strong></div>
          <small>{product.durationLabel} · Digital delivery · One-time checkout charge · Renewal and end-of-term behavior require confirmation</small>
        </aside>
      </div>
    </section>
  );
}

export function KeyStoreHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <header className="key-header">
      <div className="key-delivery-bar">
        <span aria-hidden="true">●</span>
        Free Nairobi delivery over KSh 10,000
      </div>
      <div className="key-main-header key-shell">
        <Link aria-label="UniPlug home" className="key-brand" href="/">
          <Image alt="UniPlug" className="uniplug-wordmark" height={40} priority src="/storefront/uniplug-logo.svg" width={152} />
        </Link>
        <nav aria-label="Store navigation">
          <Link href="/#popular">Shop</Link>
          <Link href="/?category=software#popular">Software</Link>
          <Link href="/?category=games#popular">Games</Link>
          <Link href="/?category=gaming#popular">Gaming</Link>
          <Link href="/?category=audio#popular">Audio</Link>
          <Link href="/?category=accessories#popular">Accessories</Link>
          <Link href="/help">Support</Link>
        </nav>
        <form action="/" className="key-global-search" role="search">
          <label className="sr-only" htmlFor="key-global-search">Search products</label>
          <input id="key-global-search" name="q" placeholder="Search products" type="search" />
          <button aria-label="Search" type="submit"><Search aria-hidden="true" /></button>
        </form>
        <div className="key-header-tools">
          <Link aria-label={signedIn ? "Open account settings" : "Sign in"} href={signedIn ? "/settings" : "/login"}>
            <UserRound aria-hidden="true" />
          </Link>
          <StoreCartIndicator />
        </div>
        <details className="key-mobile-menu">
          <summary aria-label="Open store navigation"><Menu aria-hidden="true" /></summary>
          <nav aria-label="Mobile store navigation">
            <Link href="/#popular">Shop</Link>
            <Link href="/?category=software#popular">Software</Link>
            <Link href="/?category=games#popular">Games</Link>
            <Link href="/?category=gaming#popular">Gaming</Link>
            <Link href="/?category=audio#popular">Audio</Link>
            <Link href="/?category=accessories#popular">Accessories</Link>
            <Link href="/help">Support</Link>
          </nav>
        </details>
        {signedIn ? (
          <button
            className="sr-only"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              const supabase = createBrowserSupabaseClient();
              await supabase.auth.signOut();
              window.location.assign("/");
            }}
            type="button"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function KeyStoreFooter() {
  return (
    <footer className="key-footer">
      <div className="key-shell key-footer-grid">
        <div className="key-footer-brand">
          <Link aria-label="UniPlug home" className="key-brand" href="/"><Image alt="UniPlug" className="uniplug-wordmark" height={37} src="/storefront/uniplug-logo-light.svg" width={142} /></Link>
          <p>Software, devices and accessories with secure local payment and support.</p>
          <a href="mailto:support@uniplug.shop">support@uniplug.shop</a>
        </div>
        <div><h2>Shop</h2><Link href="/#popular">All products</Link><Link href="/?category=software#popular">Software</Link><Link href="/?category=games#popular">Physical games</Link><Link href="/?category=gaming#popular">Gaming gear</Link></div>
        <div><h2>Help</h2><Link href="/help">Help centre</Link><Link href="/order-status">Software order status</Link><a href="mailto:support@uniplug.shop">Email support</a></div>
        <div><h2>Accounts</h2><Link href="/register">Create account</Link><Link href="/login">Sign in</Link><a href="https://vip.uniplug.shop">VIP client portal</a></div>
      </div>
      <div className="key-shell key-footer-bottom"><p>© 2026 UniPlug Kenya. All rights reserved.</p><p>Prices shown in Kenyan shillings (KSh).</p></div>
    </footer>
  );
}
