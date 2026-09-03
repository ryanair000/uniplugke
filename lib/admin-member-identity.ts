import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;
export type AdminClientIdentityAlias = { alias_client_id: string; canonical_client_id: string };

const PAGE_SIZE = 1000;
const ALIAS_CACHE_MS = 15_000;
let aliasCache: { expiresAt: number; promise: Promise<AdminClientIdentityAlias[]> } | null = null;

async function loadAllAliases(admin: AdminClient) {
  const rows: AdminClientIdentityAlias[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("client_identity_aliases")
      .select("alias_client_id,canonical_client_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as AdminClientIdentityAlias[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

export function getCachedAdminIdentityAliases(admin: AdminClient) {
  const now = Date.now();
  if (aliasCache && aliasCache.expiresAt > now) return aliasCache.promise;

  const promise = loadAllAliases(admin).catch((error) => {
    if (aliasCache?.promise === promise) aliasCache = null;
    throw error;
  });
  aliasCache = { expiresAt: now + ALIAS_CACHE_MS, promise };
  return promise;
}
