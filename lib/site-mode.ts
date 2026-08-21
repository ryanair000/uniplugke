import "server-only";

import { headers } from "next/headers";

export const VIP_HOST = "vip.uniplug.shop";
export const VIP_LOCAL_HOST = "vip.localhost";
export const STORE_HOST = "uniplug.shop";

export function isKeysHostname(hostname: string) {
  const normalized = hostname.split(":")[0].toLowerCase();
  return normalized !== VIP_HOST && normalized !== VIP_LOCAL_HOST;
}

export async function isKeysStoreRequest() {
  const host = (await headers()).get("x-forwarded-host") || (await headers()).get("host") || "";
  return isKeysHostname(host);
}
