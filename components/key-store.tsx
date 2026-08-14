"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KEY_PRODUCTS,
  keyProductEndOfTermDisclosure,
  keyProductPaymentDisclosure,
  type KeyProduct,
  type KeyProductSlug
} from "@/lib/key-products";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { RequestKeyForm } from "@/components/key-support";

const money = new Intl.NumberFormat("en-KE");
const products = Object.values(KEY_PRODUCTS);

type CategoryFilter = "all" | KeyProduct["category"];

const trustItems = [
  { icon: "/key-store/icon-10.svg", title: "Software licences", copy: "Clear terms on every product" },
  { icon: "/key-store/icon-02.svg", title: "Digital delivery", copy: "Sent to your order email" },
  { icon: "/key-store/icon-06.svg", title: "Activation support", copy: "Help when you need it" },
  { icon: "/key-store/icon-11.svg", title: "Secure payment", copy: "Protected Paystack checkout" }
];

const steps = [
  { number: "01", title: "Choose your key", copy: "Select the software and licence term that fits your needs." },
  { number: "02", title: "Checkout securely", copy: "Enter your delivery details and complete payment through Paystack." },
  { number: "03", title: "Receive your key", copy: "Your order is prepared for digital delivery to the email you provide." },
  { number: "04", title: "Activate", copy: "Follow the included instructions, with support available if you need it." }
];

const keyFaqs = [
  {
    question: "When will my software key arrive?",
    answer: "Delivery is digital, but UniPlug has not yet published a guaranteed delivery window. After payment, keep the KEY reference shown on the payment page and use Order status to follow payment and fulfilment."
  },
  {
    question: "What happens if payment is still pending?",
    answer: "Do not pay again immediately. Keep the KEY reference and check Order status. If Paystack charged you but the order remains unconfirmed, email support@uniplug.shop with that reference."
  },
  {
    question: "What should I do if activation fails?",
    answer: "Check the supplied activation instructions, then contact support with the KEY reference and the exact error message. Never send passwords, payment credentials, or one-time codes. Replacement eligibility is confirmed case by case until a published policy is supplied."
  },
  {
    question: "Can I move a key to another device?",
    answer: "Device and activation limits differ by licence and have not yet been confirmed for these listings. Confirm compatibility and transfer rights before payment."
  },
  {
    question: "Are refunds or cancellations available?",
    answer: "UniPlug has not yet supplied a public software-key refund or cancellation policy. Confirm the applicable conditions before payment; do not assume a key can be returned after delivery or activation."
  },
  {
    question: "Does the one-month or one-year term renew automatically?",
    answer: "The current checkout creates one Paystack charge and does not create an automatic recurring charge. Access or renewal after the advertised term still requires confirmation before payment."
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
      <span>{product.badge}</span>
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
  priority = false,
  onDetails
}: {
  product: KeyProduct;
  checkoutBase?: string;
  priority?: boolean;
  onDetails?: (product: KeyProduct) => void;
}) {
  return (
    <article className="key-catalog-card">
      <ProductImage priority={priority} product={product} />
      <div className="key-catalog-card-body">
        <p className="key-card-category">{product.categoryLabel}</p>
        <h3><Link href={`/keys/${product.slug}`}>{product.name}</Link></h3>
        <p className="key-card-description">{product.description}</p>
        <ProductFacts product={product} />
        <ProductScopeNotice product={product} />
        <div className="key-card-purchase">
          <div className="key-price">
            <strong>KSh {money.format(product.priceKes)}</strong>
            <span>for {product.termLabel}</span>
          </div>
          <div className="key-card-actions">
            {onDetails ? (
              <button className="key-button key-button-outline" onClick={() => onDetails(product)} type="button">
                Quick view
              </button>
            ) : null}
            <Link aria-label={`Buy ${product.name} for KSh ${money.format(product.priceKes)} for ${product.termLabel}`} className="key-button key-button-dark" href={`${checkoutBase}/checkout?product=${product.slug}`}>
              Buy now <span aria-hidden="true">→</span>
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
  const [activeProduct, setActiveProduct] = useState<KeyProduct | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const detailsTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q")?.trim() || "";
    const initialCategory = new URLSearchParams(window.location.search).get("category");
    const initialQueryTimer = window.setTimeout(() => {
      if (initialQuery) setQuery(initialQuery);
      if (initialCategory === "pdf" || initialCategory === "operating-system") setCategory(initialCategory);
    }, 0);

    const handleHeaderSearch = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      setQuery(value);
    };
    window.addEventListener("key-store-search", handleHeaderSearch);
    return () => {
      window.clearTimeout(initialQueryTimer);
      window.removeEventListener("key-store-search", handleHeaderSearch);
    };
  }, []);

  useEffect(() => {
    if (!activeProduct) return;
    const backgroundElements = Array.from(document.querySelectorAll<HTMLElement>(".key-store > :not(.key-modal-backdrop)"));
    const backgroundState = backgroundElements.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.hasAttribute("inert")
    }));
    backgroundElements.forEach((element) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveProduct(null);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusIsOutsideDialog = !dialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog || focusIsOutsideDialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog || focusIsOutsideDialog)) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>(".key-modal-close")?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      backgroundState.forEach(({ element, ariaHidden, inert }) => {
        if (!inert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      detailsTriggerRef.current?.focus();
    };
  }, [activeProduct]);

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

  const openDetails = (product: KeyProduct) => {
    detailsTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveProduct(product);
  };

  return (
    <div className="key-store">
      <section className="key-catalog key-shell" id="catalog" aria-labelledby="catalog-title">
        <div className="key-catalog-toolbar">
          <div>
            <h1 id="catalog-title">Software keys</h1>
            <p>Choose a software key with clear pricing, secure checkout, and digital delivery.</p>
          </div>
          <p aria-live="polite" className="key-result-count">{visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}</p>
        </div>

        <div className="key-category-chips" aria-label="Product categories">
          <button className={category === "all" ? "is-active" : ""} onClick={() => selectCategory("all")} type="button">All keys <span>2</span></button>
          <button className={category === "pdf" ? "is-active" : ""} onClick={() => selectCategory("pdf")} type="button">PDF tools <span>1</span></button>
          <button className={category === "operating-system" ? "is-active" : ""} onClick={() => selectCategory("operating-system")} type="button">Windows <span>1</span></button>
        </div>

        <div className="key-catalog-results">
            {query ? (
              <div className="key-search-summary">
                <span>Results for “{query}”</span>
                <button onClick={clearQuery} type="button">Clear search</button>
              </div>
            ) : null}
            {visibleProducts.length ? visibleProducts.map((product, index) => (
              <ProductCard key={product.slug} onDetails={openDetails} priority={index === 0} product={product} />
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
          <div className="key-how-heading"><div><p className="key-kicker">Simple from start to finish</p><h2 id="how-title">How purchasing works</h2></div><p>Four clear steps from choosing your software to activation.</p></div>
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

      <section className="key-trust-strip" aria-label="Why buy from UniPlug">
        <div className="key-shell">
          {trustItems.map((item) => (
            <article key={item.title}>
              <Image alt="" height={34} src={item.icon} width={34} />
              <div><strong>{item.title}</strong><span>{item.copy}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="key-faq key-shell" aria-labelledby="key-faq-title">
        <div className="key-faq-heading"><div><p className="key-kicker">Before and after payment</p><h2 id="key-faq-title">Software-key help</h2></div><p>Current answers use confirmed facts and clearly identify terms that still require confirmation.</p></div>
        <div className="key-faq-list">
          {keyFaqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
        </div>
        <div className="key-faq-support"><p>Need order-specific help? Keep your <strong>KEY reference</strong>.</p><div><Link href="/order-status">Check order status</Link><a href="mailto:support@uniplug.shop">Email support</a></div></div>
      </section>

      {activeProduct ? (
        <div className="key-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setActiveProduct(null)}>
          <section aria-describedby="key-modal-description" aria-labelledby="key-modal-title" aria-modal="true" className="key-product-modal" ref={dialogRef} role="dialog" tabIndex={-1}>
            <button aria-label="Close product details" className="key-modal-close" onClick={() => setActiveProduct(null)} type="button">×</button>
            <ProductImage product={activeProduct} />
            <div className="key-product-modal-content">
              <p className="key-card-category">{activeProduct.categoryLabel}</p>
              <h2 id="key-modal-title">{activeProduct.name}</h2>
              <p id="key-modal-description">{activeProduct.details}</p>
              <ProductFacts product={activeProduct} />
              <ProductScopeNotice product={activeProduct} />
              <div className="key-modal-disclosures">
                <p>{keyProductPaymentDisclosure(activeProduct)}</p>
                <p>{keyProductEndOfTermDisclosure(activeProduct)}</p>
              </div>
              <Link className="key-full-details-link" href={`/keys/${activeProduct.slug}`}>View full licence details</Link>
              <div className="key-price"><strong>KSh {money.format(activeProduct.priceKes)}</strong><span>for {activeProduct.termLabel}</span></div>
              <Link className="key-button key-button-dark" href={`/checkout?product=${activeProduct.slug}`}>Buy now <span aria-hidden="true">→</span></Link>
            </div>
          </section>
        </div>
      ) : null}
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
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.history.replaceState(null, "", search.trim() ? `/?q=${encodeURIComponent(search.trim())}#catalog` : "/#catalog");
    window.dispatchEvent(new CustomEvent("key-store-search", { detail: search.trim() }));
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="key-utility-bar">
        <div className="key-shell">
          <span><Image alt="" height={22} src="/key-store/icon-08.svg" width={22} />Digital delivery</span>
          <span><Image alt="" height={22} src="/key-store/icon-09.svg" width={22} />Secure Paystack checkout</span>
          <span><Image alt="" height={22} src="/key-store/icon-01.svg" width={22} />Activation support</span>
        </div>
      </div>
      <header className="key-header">
      <div className="key-main-header key-shell">
        <Link aria-label="UniPlug software keys home" className="key-brand" href="/"><span>u</span><b>uniplug</b></Link>
        <form className="key-header-search" onSubmit={submitSearch} role="search">
          <Image alt="" height={22} src="/key-store/icon-04.svg" width={22} />
          <input aria-label="Search software keys" onChange={(event) => setSearch(event.target.value)} placeholder="Search software keys" type="search" value={search} />
          <button type="submit">Search</button>
        </form>
        <nav aria-label="Store navigation">
          <Link href="/#catalog">Categories</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#support">Support</Link>
          {!signedIn ? <Link href="/register">Register</Link> : null}
        </nav>
        {signedIn ? (
          <button
            className="key-button key-button-member"
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
        ) : (
          <Link className="key-button key-button-member" href="/login">Sign in <span aria-hidden="true">→</span></Link>
        )}
      </div>
      </header>
    </>
  );
}

export function KeyStoreFooter() {
  return (
    <footer className="key-footer">
      <div className="key-shell key-footer-grid">
        <div className="key-footer-brand">
          <Link className="key-brand" href="/"><span>u</span><b>uniplug</b></Link>
          <p>Software keys with clear pricing, secure local checkout, and helpful activation guidance.</p>
          <a href="mailto:support@uniplug.shop">support@uniplug.shop</a>
        </div>
        <div><h2>Shop</h2><Link href="/#catalog">All software keys</Link><Link href="/?category=pdf#catalog">PDF & productivity</Link><Link href="/?category=operating-system#catalog">Operating systems</Link></div>
        <div><h2>Help</h2><Link href="/#how-it-works">How it works</Link><Link href="/order-status">Order status</Link><Link href="/#support">Request a key</Link><a href="mailto:support@uniplug.shop">Email support</a></div>
        <div><h2>Accounts</h2><Link href="/register">Create account</Link><Link href="/login">Sign in</Link><a href="https://vip.uniplug.shop">VIP client portal</a></div>
      </div>
      <div className="key-shell key-footer-bottom"><p>© 2026 UniPlug Kenya. All rights reserved.</p><p>Prices shown in Kenyan shillings (KSh).</p></div>
    </footer>
  );
}
