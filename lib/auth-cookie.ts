export function authCookieOptionsForHostname(hostname: string) {
  const normalized = hostname.split(":")[0].toLowerCase();
  const isUniPlugDomain = normalized === "uniplug.shop" || normalized.endsWith(".uniplug.shop");
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: isUniPlugDomain,
    ...(isUniPlugDomain ? { domain: ".uniplug.shop" } : {})
  };
}
