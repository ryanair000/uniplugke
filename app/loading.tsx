export default function Loading() {
  return (
    <section className="store-loading" role="status" aria-live="polite">
      <span className="sr-only">Loading products</span>
      <div className="commerce-shell store-loading-hero" aria-hidden="true">
        <div className="store-loading-copy">
          <span />
          <strong />
          <strong />
          <p />
          <i />
        </div>
        <div className="store-loading-visual" />
      </div>
      <div className="store-loading-categories" aria-hidden="true" />
      <div className="commerce-shell store-loading-products" aria-hidden="true">
        <div className="store-loading-heading" />
        <div className="store-loading-grid">{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div>
      </div>
    </section>
  );
}
