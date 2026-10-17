import "server-only";

import { headers } from "next/headers";
import { isVipHostname, normalizeHostname, STORE_ORIGIN, VIP_SITE_ORIGIN } from "@/lib/domains";

export const VIP_HOST = new URL(VIP_SITE_ORIGIN).hostname;
export const VIP_LOCAL_HOST = "vip.localhost";
export const STORE_HOST = new URL(STORE_ORIGIN).hostname;

function isVercelVipPreview(hostname: string) {
  return process.env.VERCEL_ENV === "preview" && hostname.endsWith(".vercel.app");
}

export function isKeysHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (isVercelVipPreview(normalized)) return false;
  return !isVipHostname(normalized);
}

export async function isKeysStoreRequest() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  return isKeysHostname(host);
}
