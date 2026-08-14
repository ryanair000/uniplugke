export const PLAN_DURATIONS = [
  { months: 1, label: "1 month", shortLabel: "1 mo", badge: "Most flexible", discountPercent: 0 },
  { months: 3, label: "3 months", shortLabel: "3 mo", badge: null, discountPercent: 3 },
  { months: 6, label: "6 months", shortLabel: "6 mo", badge: "Popular", discountPercent: 8 },
  { months: 12, label: "1 year", shortLabel: "1 yr", badge: "Best value", discountPercent: 13 },
  { months: 24, label: "2 years", shortLabel: "2 yr", badge: "Lowest monthly", discountPercent: 17 }
] as const;

export type PlanDurationMonths = (typeof PLAN_DURATIONS)[number]["months"];

export type PlanDurationOffer = {
  durationMonths: PlanDurationMonths;
  discountPercent: number;
  badge: string | null;
  isActive: boolean;
};

export function isPlanDurationMonths(value: unknown): value is PlanDurationMonths {
  return PLAN_DURATIONS.some((duration) => duration.months === Number(value));
}

export function planDurationLabel(months: number) {
  return PLAN_DURATIONS.find((duration) => duration.months === months)?.label ?? `${months} months`;
}

export function defaultPlanDurationOffer(durationMonths: PlanDurationMonths): PlanDurationOffer {
  const duration = PLAN_DURATIONS.find((candidate) => candidate.months === durationMonths)!;
  return {
    durationMonths,
    discountPercent: duration.discountPercent,
    badge: duration.badge,
    isActive: true
  };
}

export function planPriceForDuration(
  monthlyPrice: number,
  durationMonths: PlanDurationMonths,
  discountPercent = defaultPlanDurationOffer(durationMonths).discountPercent
) {
  const undiscounted = monthlyPrice * durationMonths;
  return Math.round(undiscounted * (1 - discountPercent / 100) * 100) / 100;
}

export function planSavingsForDuration(
  monthlyPrice: number,
  durationMonths: PlanDurationMonths,
  discountPercent = defaultPlanDurationOffer(durationMonths).discountPercent
) {
  return Math.max(0, Math.round((monthlyPrice * durationMonths - planPriceForDuration(monthlyPrice, durationMonths, discountPercent)) * 100) / 100);
}
