export type KeyProductFact = {
  label: string;
  value: string;
};

export type KeyProductPolicySection = {
  id: "compatibility" | "activation" | "delivery" | "policy";
  title: string;
  status: "confirmed" | "confirmation-required";
  summary: string;
};

export const KEY_TERMS_VERSION = "2026-08-14-confirmation-required-v1";

export const KEY_PRODUCTS = {
  "adobe-acrobat": {
    slug: "adobe-acrobat",
    name: "Adobe Acrobat",
    priceKes: 1000,
    term: "month",
    termLabel: "1 month",
    durationLabel: "One-month licence term",
    category: "pdf",
    categoryLabel: "PDF & productivity",
    badge: "PDF tools",
    image: "/key-store/adobe-acrobat.svg",
    imageAlt: "Adobe Acrobat software key artwork",
    description: "Adobe Acrobat software access offered for a one-month term.",
    details: "This listing covers Adobe Acrobat software access for one month, with digital delivery and activation support.",
    facts: [
      { label: "Licence term", value: "1 month" },
      { label: "Delivery", value: "Digital delivery" },
      { label: "Payment", value: "One-time checkout charge" },
      { label: "Support", value: "Activation support" }
    ],
    pendingTerms: [
      "Exact Acrobat edition and licence type",
      "Supported devices, operating systems, and activation count",
      "Country or region restrictions",
      "Renewal and end-of-term access behavior",
      "Delivery timing and fulfilment method",
      "Replacement, refund, and cancellation conditions"
    ],
    sections: [
      {
        id: "compatibility",
        title: "Compatibility",
        status: "confirmation-required",
        summary: "The exact Acrobat edition, supported operating systems, minimum requirements, device count, and activation limit have not yet been supplied. Confirm these details before payment."
      },
      {
        id: "activation",
        title: "Activation",
        status: "confirmed",
        summary: "Activation support is included. Exact activation steps and expected completion time are confirmed during fulfilment."
      },
      {
        id: "delivery",
        title: "Delivery",
        status: "confirmed",
        summary: "Delivery is digital. The exact delivery method and fulfilment target have not yet been supplied."
      },
      {
        id: "policy",
        title: "Replacement and refunds",
        status: "confirmation-required",
        summary: "Failed-activation replacement, refund, and cancellation conditions have not yet been supplied. Confirm them before payment."
      }
    ]
  },
  "windows-11-pro": {
    slug: "windows-11-pro",
    name: "Windows 11 Pro",
    priceKes: 2500,
    term: "year",
    termLabel: "1 year",
    durationLabel: "One-year licence term",
    category: "operating-system",
    categoryLabel: "Operating systems",
    badge: "Operating system",
    image: "/key-store/windows-11-pro.svg",
    imageAlt: "Windows 11 Pro software key artwork",
    description: "Windows 11 Pro software access offered for a one-year term.",
    details: "This listing covers Windows 11 Pro software access for one year, with digital delivery and activation support.",
    facts: [
      { label: "Licence term", value: "1 year" },
      { label: "Delivery", value: "Digital delivery" },
      { label: "Payment", value: "One-time checkout charge" },
      { label: "Support", value: "Activation support" }
    ],
    pendingTerms: [
      "Retail, OEM, or other licence type",
      "Supported devices, hardware eligibility, and activation count",
      "Country or region restrictions",
      "Renewal and end-of-term access behavior",
      "Delivery timing and fulfilment method",
      "Replacement, refund, and cancellation conditions"
    ],
    sections: [
      {
        id: "compatibility",
        title: "Compatibility",
        status: "confirmation-required",
        summary: "The exact licence type, hardware eligibility, minimum requirements, device count, and activation limit have not yet been supplied. Confirm these details before payment."
      },
      {
        id: "activation",
        title: "Activation",
        status: "confirmed",
        summary: "Activation support is included. Exact activation steps and expected completion time are confirmed during fulfilment."
      },
      {
        id: "delivery",
        title: "Delivery",
        status: "confirmed",
        summary: "Delivery is digital. The exact delivery method and fulfilment target have not yet been supplied."
      },
      {
        id: "policy",
        title: "Replacement and refunds",
        status: "confirmation-required",
        summary: "Failed-activation replacement, refund, and cancellation conditions have not yet been supplied. Confirm them before payment."
      }
    ]
  }
} as const;

export type KeyProductSlug = keyof typeof KEY_PRODUCTS;
export type KeyProduct = (typeof KEY_PRODUCTS)[KeyProductSlug];

export function getKeyProduct(value: unknown) {
  const slug = String(value || "") as KeyProductSlug;
  return KEY_PRODUCTS[slug] || null;
}

export function keyProductPaymentDisclosure(product: KeyProduct) {
  return `One Paystack charge of KSh ${product.priceKes.toLocaleString("en-KE")} for the advertised ${product.termLabel} term. This checkout does not create an automatic recurring charge.`;
}

export function keyProductEndOfTermDisclosure(product: KeyProduct) {
  return `Renewal and access after the advertised ${product.termLabel} term have not yet been confirmed. Verify these conditions with UniPlug before payment.`;
}
