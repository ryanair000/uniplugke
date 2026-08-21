"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="dashboard-error">
      <div className="dashboard-error-card">
        <p className="eyebrow">My UniPlug</p>
        <h1>We could not load this page.</h1>
        <p>Your account data has not been removed. Try loading the dashboard again, or contact support if the problem continues.</p>
        <div className="dashboard-error-actions">
          <button className="button button-dark" onClick={() => reset()}>Try again</button>
          <Link className="button button-light" href="/dashboard/support">Get support</Link>
        </div>
      </div>
    </div>
  );
}
