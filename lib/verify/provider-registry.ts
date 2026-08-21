import "server-only";

import { netflixVerifyProvider } from "@/lib/verify/providers/netflix";
import type { VerifyProviderAdapter, VerifyProviderId } from "@/lib/verify/provider-types";

const providers = new Map<VerifyProviderId, VerifyProviderAdapter>([
  [netflixVerifyProvider.id, netflixVerifyProvider]
]);

export function getVerifyProvider(value: unknown) {
  return typeof value === "string" ? providers.get(value as VerifyProviderId) || null : null;
}

export function listVerifyProviders() {
  return [...providers.values()];
}

export function needsRecentAuthentication(
  provider: VerifyProviderAdapter,
  authenticatedAt: string | null | undefined,
  now = Date.now()
) {
  if (!provider.recentAuthenticationMaxAgeSeconds) return false;
  const authenticatedAtMs = authenticatedAt ? new Date(authenticatedAt).getTime() : Number.NaN;
  return !Number.isFinite(authenticatedAtMs)
    || now - authenticatedAtMs > provider.recentAuthenticationMaxAgeSeconds * 1000;
}
