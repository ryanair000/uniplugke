import Link from "next/link";

export function RenewPlanButton({ subscriptionId, disabled = false }: { subscriptionId: string; disabled?: boolean }) {
  if (disabled) return <button type="button" className="button button-dark" disabled>Renewal unavailable</button>;
  return <Link className="button button-dark" href={`/dashboard/subscriptions/${subscriptionId}/renew`}>Renew this plan</Link>;
}
