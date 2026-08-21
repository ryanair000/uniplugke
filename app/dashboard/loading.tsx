export default function DashboardLoading() {
  return (
    <div className="dashboard-loading" aria-label="Loading member dashboard">
      <div className="loading-block loading-heading" />
      <div className="loading-block loading-notice" />
      <div className="loading-grid">
        <div className="loading-block" /><div className="loading-block" /><div className="loading-block" /><div className="loading-block" />
      </div>
      <div className="loading-block loading-panel" />
    </div>
  );
}
