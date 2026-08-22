import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Client directory is not configured." }, { status: 503 });

  const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) || "";
  let query = admin.from("clients")
    .select("id,client_code,display_name,email,phone,phone_e164,whatsapp,whatsapp_e164,status,portal_access_status,portal_sync_error,portal_sync_updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (search) {
    const safe = search.replace(/[%_,()]/g, " ").trim();
    if (safe) query = query.or(`display_name.ilike.%${safe}%,client_code.ilike.%${safe}%,phone.ilike.%${safe}%,phone_e164.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data: rawClients, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rawIds = (rawClients || []).map((client) => client.id);
  const { data: directAliases, error: directAliasError } = rawIds.length
    ? await admin.from("client_identity_aliases").select("alias_client_id,canonical_client_id").in("alias_client_id", rawIds)
    : { data: [], error: null };
  if (directAliasError) return NextResponse.json({ error: directAliasError.message }, { status: 500 });

  const aliasToCanonical = new Map((directAliases || []).map((row) => [row.alias_client_id, row.canonical_client_id] as const));
  const canonicalIds = [...new Set((rawClients || []).map((client) => aliasToCanonical.get(client.id) || client.id))];
  const { data: canonicalRows, error: canonicalError } = canonicalIds.length
    ? await admin.from("clients")
        .select("id,client_code,display_name,email,phone,phone_e164,whatsapp,whatsapp_e164,status,portal_access_status,portal_sync_error,portal_sync_updated_at")
        .in("id", canonicalIds)
        .is("deleted_at", null)
    : { data: [], error: null };
  if (canonicalError) return NextResponse.json({ error: canonicalError.message }, { status: 500 });

  const clients = [...new Map((canonicalRows || []).map((client) => [client.id, client])).values()].slice(0, 25);
  const ids = clients.map((client) => client.id);
  const { data: siblingAliases, error: siblingError } = ids.length
    ? await admin.from("client_identity_aliases").select("alias_client_id,canonical_client_id").in("canonical_client_id", ids)
    : { data: [], error: null };
  if (siblingError) return NextResponse.json({ error: siblingError.message }, { status: 500 });

  const familyIdToCanonical = new Map(ids.map((id) => [id, id] as const));
  for (const alias of siblingAliases || []) familyIdToCanonical.set(alias.alias_client_id, alias.canonical_client_id);
  const familyIds = [...familyIdToCanonical.keys()];

  const [{ data: subscriptions }, { data: portals }] = familyIds.length ? await Promise.all([
    admin.from("client_subscriptions")
      .select("client_id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
      .in("client_id", familyIds),
    admin.from("client_portal_accounts")
      .select("client_id,must_change_password,last_login_at")
      .in("client_id", familyIds)
  ]) : [{ data: [] }, { data: [] }];

  const result = clients.map((client) => {
    const tracked = (subscriptions || []).filter((subscription) => {
      const canonicalId = familyIdToCanonical.get(subscription.client_id) || subscription.client_id;
      return canonicalId === client.id && subscription.metadata?.portal_hidden !== true && subscription.metadata?.interest_only !== true;
    });
    const portal = (portals || []).find((item) => (familyIdToCanonical.get(item.client_id) || item.client_id) === client.id);
    const services = [...new Map(tracked.map((subscription) => {
      const service = (Array.isArray(subscription.service) ? subscription.service[0] : subscription.service) as { name?: string } | null;
      const name = service?.name || "Service";
      return [`${name}:${subscription.status}`, { name, status: subscription.status }];
    })).values()];
    return {
      ...client,
      services,
      portal: portal || null,
      aliasCount: (siblingAliases || []).filter((item) => item.canonical_client_id === client.id).length
    };
  });

  return NextResponse.json({ clients: result }, { headers: { "Cache-Control": "no-store" } });
}
