import Link from "next/link";

export function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export function formatKes(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `KSh ${Number(value).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", options || { dateStyle: "medium" });
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = new Date(value).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["active", "paid", "completed", "success", "available"].includes(normalized)) return "success";
  if (["pending", "pending_activation", "processing", "created"].includes(normalized)) return "info";
  if (["past_due", "expiring", "limited"].includes(normalized)) return "warning";
  if (["failed", "cancelled", "canceled", "declined", "suspended"].includes(normalized)) return "danger";
  return "neutral";
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`status-pill status-${statusTone(status)}`}>{label || readableStatus(status)}</span>;
}

export function renewalLabel(date: string | null | undefined) {
  if (!date) return "No renewal scheduled";
  const days = daysUntil(date);
  if (days == null) return formatDate(date);
  if (days < 0) return `Ended ${formatDate(date)}`;
  if (days === 0) return "Renews today";
  if (days === 1) return "Renews tomorrow";
  if (days <= 7) return `Renews in ${days} days`;
  return `Renews ${formatDate(date)}`;
}

export function eventHref(entityType: string | null, entityId: string | null) {
  if (!entityId) return null;
  if (entityType === "order") return `/dashboard/orders/${entityId}`;
  if (entityType === "subscription") return `/dashboard/subscriptions/${entityId}`;
  return null;
}

export function DashboardNotice({
  tone = "info",
  title,
  body,
  href,
  action
}: {
  tone?: "success" | "info" | "warning" | "danger";
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className={`dashboard-notice notice-${tone}`}>
      <div><strong>{title}</strong><p>{body}</p></div>
      {href && action ? <Link href={href}>{action} →</Link> : null}
    </div>
  );
}
