"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  keyProductEndOfTermDisclosure,
  keyProductPaymentDisclosure,
  type KeyProduct
} from "@/lib/key-products";

const money = new Intl.NumberFormat("en-KE");

export function KeyProductDetail({ product }: { product: KeyProduct }) {
  const supportSubject = encodeURIComponent(`${product.name} licence terms`);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showMobilePurchase, setShowMobilePurchase] = useState(false);

  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;
    const observer = new IntersectionObserver(([entry]) => setShowMobilePurchase(!entry.isIntersecting), { threshold: 0.2 });
    observer.observe(actions);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="key-detail key-shell">
      <nav aria-label="Breadcrumb" className="key-detail-breadcrumb">
        <Link href="/">Software keys</Link><span aria-hidden="true">/</span><span>{product.name}</span>
      </nav>

      <section className="key-detail-overview">
        <div className="key-detail-art">
          <Image alt={product.imageAlt} fill priority sizes="(max-width: 760px) calc(100vw - 32px), 480px" src={product.image} />
          <span>{product.badge}</span>
        </div>
        <div className="key-detail-summary">
          <p className="key-card-category">{product.categoryLabel}</p>
          <h1>{product.name}</h1>
          <p className="key-detail-intro">{product.details}</p>

          <div className="key-detail-price"><strong>KSh {money.format(product.priceKes)}</strong><span>for {product.termLabel}</span></div>
          <div className="key-detail-actions" ref={actionsRef}>
            <Link className="key-button key-button-dark" href={`/checkout?product=${product.slug}`}>Continue to checkout <span aria-hidden="true">→</span></Link>
            <a className="key-button key-button-outline" href={`mailto:support@uniplug.shop?subject=${supportSubject}`}>Ask about this licence</a>
          </div>
          <dl className="key-detail-facts">
            {product.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
          <p className="key-detail-payment">{keyProductPaymentDisclosure(product)}</p>
          <p className="key-detail-warning"><strong>End of term:</strong> {keyProductEndOfTermDisclosure(product)}</p>
        </div>
      </section>

      <section aria-labelledby="pending-terms-title" className="key-detail-pending">
        <div>
          <p className="key-kicker">Before you buy</p>
          <h2 id="pending-terms-title">Check these licence details</h2>
          <p>We still need to confirm a few details for this listing. Ask us before paying if any of them affect your purchase.</p>
        </div>
        <ul>
          {product.pendingTerms.map((term) => <li key={term}>{term}</li>)}
        </ul>
      </section>

      <section aria-label={`${product.name} licence information`} className="key-detail-sections">
        {product.sections.map((section) => (
          <article key={section.id} id={section.id}>
            <div>
              <h2>{section.title}</h2>
              <span className={section.status === "confirmed" ? "is-confirmed" : "is-pending"}>
                {section.status === "confirmed" ? "Partly confirmed" : "Confirmation required"}
              </span>
            </div>
            <p>{section.summary}</p>
          </article>
        ))}
      </section>

      <section className="key-detail-final-cta">
        <div><p className="key-kicker">Checkout</p><h2>Review the price and licence details before payment.</h2></div>
        <Link className="key-button key-button-lime" href={`/checkout?product=${product.slug}`}>Continue with {product.name} <span aria-hidden="true">→</span></Link>
      </section>

      <div className={`key-mobile-purchase${showMobilePurchase ? " is-visible" : ""}`} aria-label="Purchase controls">
        <div><span>{product.termLabel}</span><strong>KSh {money.format(product.priceKes)}</strong></div>
        <Link className="key-button key-button-lime" href={`/checkout?product=${product.slug}`}>Continue</Link>
      </div>
    </article>
  );
}
