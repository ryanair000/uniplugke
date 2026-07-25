import Link from "next/link";

export default function NotFound() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">⚡</div>
        <p className="eyebrow">Page not found</p>
        <h1>This service is not here.</h1>
        <p>The link may be outdated, or the service may no longer be available in the catalog.</p>
        <Link className="button button-dark" href="/services">Browse services</Link>
      </div>
    </section>
  );
}
