export function normalizeKenyanPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export function temporaryPhonePassword(phoneE164: string) {
  return phoneE164.replace(/\D/g, "");
}
