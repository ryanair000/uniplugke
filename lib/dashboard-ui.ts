export const KENYA_TIME_ZONE = "Africa/Nairobi";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const statusLabels: Record<string, string> = {
  active: "Active",
  paid: "Paid",
  completed: "Completed",
  pending: "Pending",
  pending_activation: "Activation pending",
  pending_payment: "Payment pending",
  processing: "Processing",
  past_due: "Payment needed",
  manual_review: "Under review",
  paused: "Paused",
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Payment failed",
  initialization_failed: "Payment failed",
  amount_mismatch: "Payment issue",
  refunded: "Refunded",
  declined: "Declined"
};

export function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function formatDateKe(value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat("en-KE", { timeZone: KENYA_TIME_ZONE, ...options }).format(new Date(value));
}

export function formatDateTimeKe(value: string | Date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: KENYA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function statusLabel(value: string) {
  return statusLabels[value] || value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusTone(value: string): StatusTone {
  if (["active", "paid", "completed"].includes(value)) return "success";
  if (["pending", "pending_activation", "pending_payment", "processing", "past_due"].includes(value)) return "warning";
  if (["failed", "initialization_failed", "amount_mismatch"].includes(value)) return "danger";
  if (["manual_review"].includes(value)) return "info";
  return "neutral";
}

export function statusClassName(value: string, extra = "") {
  return ["status-badge", `status-${statusTone(value)}`, extra].filter(Boolean).join(" ");
}

export function daysUntil(value: string | Date) {
  const end = new Date(value).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function subscriptionDateLabel(currentPeriodEnd: string | null, autoRenew: boolean) {
  if (!currentPeriodEnd) return "Activation pending";
  const days = daysUntil(currentPeriodEnd);
  if (days < 0) return `Expired ${formatDateKe(currentPeriodEnd)}`;
  if (days === 0) return autoRenew ? "Renews today" : "Expires today";
  if (days === 1) return autoRenew ? "Renews tomorrow" : "Expires tomorrow";
  if (days <= 7) return autoRenew ? `Renews in ${days} days` : `Expires in ${days} days`;
  return `${autoRenew ? "Renews" : "Access until"} ${formatDateKe(currentPeriodEnd)}`;
}

export function eventHref(entityType: string | null, entityId: string | null) {
  if (!entityId && entityType !== "profile") return null;
  if (entityType === "order") return `/dashboard/orders/${entityId}`;
  if (entityType === "subscription") return `/dashboard/subscriptions/${entityId}`;
  if (entityType === "profile") return "/settings";
  return null;
}
