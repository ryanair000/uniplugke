export const KEY_PRODUCTS = {
  "adobe-acrobat": {
    slug: "adobe-acrobat",
    name: "Adobe Acrobat",
    priceKes: 1000,
    term: "month",
    badge: "PDF tools",
    description: "Edit, convert, sign, and organise PDFs with a genuine activation key.",
    features: ["Fast digital delivery", "Activation guidance", "30-day licence term"]
  },
  "windows-11-pro": {
    slug: "windows-11-pro",
    name: "Windows 11 Pro",
    priceKes: 2500,
    term: "year",
    badge: "Operating system",
    description: "Unlock Windows 11 Pro features with a one-year activation key.",
    features: ["Fast digital delivery", "Activation guidance", "12-month licence term"]
  }
} as const;

export type KeyProductSlug = keyof typeof KEY_PRODUCTS;

export function getKeyProduct(value: unknown) {
  const slug = String(value || "") as KeyProductSlug;
  return KEY_PRODUCTS[slug] || null;
}

