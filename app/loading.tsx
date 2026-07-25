export default function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="loading-card">
        <span className="brand-mark">⚡</span>
        <h2>Loading UniPlug</h2>
        <p>Preparing your catalog and member experience.</p>
        <div className="loading-bar" aria-hidden="true" />
      </div>
    </div>
  );
}
