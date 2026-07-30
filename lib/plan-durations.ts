export const PLAN_DURATIONS = [
  { months: 3, label: "3 months", shortLabel: "3 mo" },
  { months: 6, label: "6 months", shortLabel: "6 mo" },
  { months: 12, label: "12 months", shortLabel: "12 mo" },
  { months: 36, label: "3 years", shortLabel: "3 yr" }
] as const;

export type PlanDurationMonths = (typeof PLAN_DURATIONS)[number]["months"];

export function isPlanDurationMonths(value: unknown): value is PlanDurationMonths {
  return PLAN_DURATIONS.some((duration) => duration.months === Number(value));
}

export function planDurationLabel(months: number) {
  return PLAN_DURATIONS.find((duration) => duration.months === months)?.label ?? `${months} months`;
}

export function planPriceForDuration(monthlyPriceKes: number, durationMonths: PlanDurationMonths) {
  return Math.round(monthlyPriceKes * durationMonths);
}
