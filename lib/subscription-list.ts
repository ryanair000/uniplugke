export type SubscriptionListItem = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  nextRenewalDate: string | null;
  createdAt: string | null;
  serviceIdentifier: string | null;
  service: {
    id: string;
    name: string;
  } | null;
};

const statusPriority: Record<string, number> = {
  active: 0,
  due_soon: 1,
  trial: 2,
  past_due: 3,
  pending_activation: 4,
  pending: 4,
  paused: 5,
  expired: 6,
  cancelled: 7,
  canceled: 7
};

function priority(subscription: SubscriptionListItem) {
  return statusPriority[subscription.status] ?? 8;
}

function selectionPriority(subscription: SubscriptionListItem) {
  if (["active", "due_soon", "trial"].includes(subscription.status)) return 0;
  if (subscription.status === "past_due") return 1;
  if (["pending_activation", "pending"].includes(subscription.status)) return 2;
  if (subscription.status === "paused") return 3;
  if (subscription.status === "expired") return 4;
  if (["cancelled", "canceled"].includes(subscription.status)) return 5;
  return 6;
}

function serviceKey(subscription: SubscriptionListItem) {
  const name = subscription.service?.name || subscription.serviceIdentifier;
  const normalizedName = name?.toLowerCase().replace(/[^a-z0-9]+/g, "") || "";

  // Names are the stable identity across renewals. A replacement subscription
  // can point at a newly-created service row while still representing the same
  // customer-facing product (for example "Nord VPN" and "NordVPN").
  if (normalizedName && !["digitalservice", "trackedservice"].includes(normalizedName)) {
    return `name:${normalizedName}`;
  }
  if (subscription.service?.id) return `service:${subscription.service.id}`;
  return `subscription:${subscription.id}`;
}

function recency(subscription: SubscriptionListItem) {
  const lifecycleDates = [
    subscription.startDate,
    subscription.createdAt
  ].filter((date): date is string => Boolean(date));
  const lifecycleRecency = lifecycleDates.reduce((latest, date) => Math.max(latest, Date.parse(date) || 0), 0);
  if (lifecycleRecency) return lifecycleRecency;

  const renewalDates = [subscription.nextRenewalDate, subscription.endDate]
    .filter((date): date is string => Boolean(date));
  return renewalDates.reduce((latest, date) => Math.max(latest, Date.parse(date) || 0), 0);
}

function preferredSubscription(candidate: SubscriptionListItem, current: SubscriptionListItem) {
  const priorityDifference = selectionPriority(candidate) - selectionPriority(current);
  if (priorityDifference !== 0) return priorityDifference < 0 ? candidate : current;

  const recencyDifference = recency(candidate) - recency(current);
  if (recencyDifference !== 0) return recencyDifference > 0 ? candidate : current;

  return candidate.id.localeCompare(current.id) > 0 ? candidate : current;
}

function serviceLabel(subscription: SubscriptionListItem) {
  return subscription.service?.name || subscription.serviceIdentifier || "Digital service";
}

export function prepareSubscriptionList<T extends SubscriptionListItem>(subscriptions: T[]) {
  const uniqueSubscriptions = new Map<string, T>();

  for (const subscription of subscriptions) {
    const key = serviceKey(subscription);
    const current = uniqueSubscriptions.get(key);
    uniqueSubscriptions.set(
      key,
      current ? preferredSubscription(subscription, current) as T : subscription
    );
  }

  return [...uniqueSubscriptions.values()].sort((a, b) => {
    const statusDifference = priority(a) - priority(b);
    if (statusDifference !== 0) return statusDifference;

    const aRenewal = Date.parse(a.nextRenewalDate || a.endDate || "") || Number.POSITIVE_INFINITY;
    const bRenewal = Date.parse(b.nextRenewalDate || b.endDate || "") || Number.POSITIVE_INFINITY;
    if (aRenewal !== bRenewal) return aRenewal - bRenewal;

    return serviceLabel(a).localeCompare(serviceLabel(b));
  });
}
