export const PLAN_DURATIONS = [
  { months: 1, label: "1 month", shortLabel: "1 mo" },
  { months: 3, label: "3 months", shortLabel: "3 mo" },
  { months: 6, label: "6 months", shortLabel: "6 mo" },
  { months: 12, label: "1 year", shortLabel: "1 yr" },
  { months: 24, label: "2 years", shortLabel: "2 yr" },
  { months: 36, label: "3 years", shortLabel: "3 yr" }
] as const;

export type PlanDurationMonths = (typeof PLAN_DURATIONS)[number]["months"];

export type PlanDurationOffer = {
  durationMonths: PlanDurationMonths;
  priceKes: number;
  badge: string | null;
  isActive: boolean;
};

export function isPlanDurationMonths(value: unknown): value is PlanDurationMonths {
  return PLAN_DURATIONS.some((duration) => duration.months === Number(value));
}

export function planDurationLabel(months: number) {
  return PLAN_DURATIONS.find((duration) => duration.months === months)?.label ?? `${months} months`;
}

export function planSavingsForDuration(oneMonthPrice: number | null, offer: PlanDurationOffer) {
  if (!oneMonthPrice) return 0;
  return Math.max(0, Math.round((oneMonthPrice * offer.durationMonths - offer.priceKes) * 100) / 100);
}
