export default function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="storefront-loading">
        <span className="storefront-loading-mark" aria-hidden="true" />
        <span>Loading your services…</span>
      </div>
    </div>
  );
}
