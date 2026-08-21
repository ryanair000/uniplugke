export const KENYA_TIME_ZONE = "Africa/Nairobi";

const STATUS_LABELS: Record<string, string> = {
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

export function memberStatusLabel(value: string) {
  return STATUS_LABELS[value] || value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function memberStatusClass(value: string, extra = "") {
  return ["status-pill", `status-${value}`, extra].filter(Boolean).join(" ");
}

export function formatMemberDate(value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat("en-KE", { timeZone: KENYA_TIME_ZONE, ...options }).format(new Date(value));
}

export function formatMemberDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: KENYA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function daysUntilMemberDate(value: string | Date) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

export function servicePeriodCopy(currentPeriodEnd: string | null, autoRenew: boolean) {
  if (!currentPeriodEnd) return "Activation pending";
  const days = daysUntilMemberDate(currentPeriodEnd);
  if (days < 0) return `Expired ${formatMemberDate(currentPeriodEnd)}`;
  if (days === 0) return autoRenew ? "Renews today" : "Expires today";
  if (days === 1) return autoRenew ? "Renews tomorrow" : "Expires tomorrow";
  if (days <= 7) return autoRenew ? `Renews in ${days} days` : `Expires in ${days} days`;
  return `${autoRenew ? "Renews" : "Access until"} ${formatMemberDate(currentPeriodEnd)}`;
}

export function memberEventHref(entityType: string | null, entityId: string | null) {
  if (entityType === "order" && entityId) return `/dashboard/orders/${entityId}`;
  if (entityType === "subscription" && entityId) return `/dashboard/subscriptions/${entityId}`;
  if (entityType === "request") return "/dashboard/support";
  if (entityType === "profile") return "/dashboard/settings";
  return null;
}
