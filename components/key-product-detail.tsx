import Image from "next/image";
import Link from "next/link";
import {
  keyProductEndOfTermDisclosure,
  keyProductPaymentDisclosure,
  type KeyProduct
} from "@/lib/key-products";

const money = new Intl.NumberFormat("en-KE");

export function KeyProductDetail({ product }: { product: KeyProduct }) {
  const supportSubject = encodeURIComponent(`${product.name} licence terms`);

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

          <dl className="key-detail-facts">
            {product.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>

          <div className="key-detail-price"><strong>KSh {money.format(product.priceKes)}</strong><span>for {product.termLabel}</span></div>
          <div className="key-detail-actions">
            <Link className="key-button key-button-dark" href={`/checkout?product=${product.slug}`}>Continue to checkout <span aria-hidden="true">→</span></Link>
            <a className="key-button key-button-outline" href={`mailto:support@uniplug.shop?subject=${supportSubject}`}>Confirm terms</a>
          </div>
          <p className="key-detail-payment">{keyProductPaymentDisclosure(product)}</p>
          <p className="key-detail-warning"><strong>End of term:</strong> {keyProductEndOfTermDisclosure(product)}</p>
        </div>
      </section>

      <section aria-labelledby="pending-terms-title" className="key-detail-pending">
        <div>
          <p className="key-kicker">Truth before purchase</p>
          <h2 id="pending-terms-title">Terms still requiring confirmation</h2>
          <p>These details have not been supplied as confirmed business terms. They are shown explicitly so they cannot be mistaken for promises.</p>
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
        <div><p className="key-kicker">Ready for the next step?</p><h2>Review the same terms again at checkout.</h2></div>
        <Link className="key-button key-button-lime" href={`/checkout?product=${product.slug}`}>Continue with {product.name} <span aria-hidden="true">→</span></Link>
      </section>
    </article>
  );
}
