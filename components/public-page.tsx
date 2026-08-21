import Link from "next/link";
import type { ReactNode } from "react";

export function PublicPageIntro({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="public-page-intro">
      <div className="public-page-shell">
        <p className="public-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="public-page-summary">{description}</p>
        {children ? <div className="public-intro-actions">{children}</div> : null}
      </div>
    </section>
  );
}

export function PublicCard({
  marker,
  title,
  children
}: {
  marker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="public-card">
      {marker ? <span className="public-card-marker" aria-hidden="true">{marker}</span> : null}
      <h2>{title}</h2>
      <div className="public-card-copy">{children}</div>
    </article>
  );
}

export function PublicCta({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="public-cta">
      <div>
        <p className="public-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="public-cta-actions">
        <Link className="button button-primary" href={primaryHref}>{primaryLabel}</Link>
        {secondaryHref && secondaryLabel
          ? <Link className="button button-light" href={secondaryHref}>{secondaryLabel}</Link>
          : null}
      </div>
    </section>
  );
}

export function LegalToc({
  items
}: {
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <nav className="legal-toc" aria-label="On this page">
      <strong>On this page</strong>
      <div>
        {items.map((item) => (
          <a href={`#${item.id}`} key={item.id}>{item.label}</a>
        ))}
      </div>
    </nav>
  );
}
