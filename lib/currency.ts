const configuredKesPerUsd = Number(process.env.NEXT_PUBLIC_KES_PER_USD ?? "130");

export const KES_PER_USD =
  Number.isFinite(configuredKesPerUsd) && configuredKesPerUsd > 0
    ? configuredKesPerUsd
    : 130;

export function kesToUsd(value: number) {
  return value / KES_PER_USD;
}

export function usdToKes(value: number) {
  return Math.round(value * KES_PER_USD);
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}

export function formatDualPrice(valueKes: number) {
  return formatKes(valueKes);
}
