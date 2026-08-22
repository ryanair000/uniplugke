export function normalizePhone(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const hadPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (hadPlus && digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  if (/^00\d{7,15}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}

// Backward-compatible export used by existing login and invitation routes.
export const normalizeKenyanPhone = normalizePhone;

export function temporaryPhonePassword(phoneE164: string) {
  return phoneE164.replace(/\D/g, "");
}
