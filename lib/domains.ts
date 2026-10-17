// Public addresses are independent of the stable @members.uniplug.shop auth identities.
export const STORE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.co.ke";
export const VIP_SITE_ORIGIN = process.env.NEXT_PUBLIC_VIP_SITE_URL || "https://vip.uniplug.co.ke";

export function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().split(":")[0].replace(/\.$/, "");
}

export function isVipHostname(hostname: string) {
  return ["vip.uniplug.co.ke", "vip.uniplug.shop", "vip.localhost"].includes(normalizeHostname(hostname));
}

export function uniPlugCookieDomain(hostname: string) {
  const normalized = normalizeHostname(hostname);
  const root = ["uniplug.co.ke", "uniplug.shop"].find(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
  return root ? `.${root}` : undefined;
}
