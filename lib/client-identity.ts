import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

export async function resolveCanonicalClientId(admin: AdminClient, clientId: string) {
  const { data, error } = await admin.rpc("hub_resolve_client_id", { p_client_id: clientId });
  if (!error && typeof data === "string" && data) return data;

  let current = clientId;
  const seen = new Set<string>();
  for (let depth = 0; depth < 16 && current && !seen.has(current); depth += 1) {
    seen.add(current);
    const { data: alias, error: aliasError } = await admin
      .from("client_identity_aliases")
      .select("canonical_client_id")
      .eq("alias_client_id", current)
      .maybeSingle();
    if (aliasError || !alias?.canonical_client_id) break;
    current = alias.canonical_client_id;
  }
  return current;
}

export async function getClientFamilyIds(admin: AdminClient, clientId: string) {
  const canonicalId = await resolveCanonicalClientId(admin, clientId);
  const family = new Set<string>([canonicalId, clientId]);
  let frontier = [canonicalId];

  for (let depth = 0; depth < 16 && frontier.length; depth += 1) {
    const { data, error } = await admin
      .from("client_identity_aliases")
      .select("alias_client_id")
      .in("canonical_client_id", frontier);
    if (error) break;

    const next = (data || [])
      .map((row) => row.alias_client_id)
      .filter((id): id is string => Boolean(id) && !family.has(id));
    next.forEach((id) => family.add(id));
    frontier = next;
  }

  return { canonicalId, familyIds: [...family] };
}
