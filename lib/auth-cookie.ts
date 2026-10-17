import { uniPlugCookieDomain } from "@/lib/domains";

export function authCookieOptionsForHostname(hostname: string) {
  const domain = uniPlugCookieDomain(hostname);
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: Boolean(domain),
    ...(domain ? { domain } : {})
  };
}
