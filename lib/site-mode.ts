import "server-only";

import { headers } from "next/headers";

export const VIP_HOST = "vip.uniplug.shop";
export const VIP_LOCAL_HOST = "vip.localhost";
export const STORE_HOST = "uniplug.shop";

function isVercelVipPreview(hostname: string) {
  return process.env.VERCEL_ENV === "preview" && hostname.endsWith(".vercel.app");
}

export function isKeysHostname(hostname: string) {
  const normalized = hostname.split(":")[0].toLowerCase();
  if (isVercelVipPreview(normalized)) return false;
  return normalized !== VIP_HOST && normalized !== VIP_LOCAL_HOST;
}

export async function isKeysStoreRequest() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  return isKeysHostname(host);
}
