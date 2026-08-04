import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Client directory is not configured." }, { status: 503 });

  const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 80) || "";
  let query = admin.from("clients")
    .select("id,client_code,display_name,email,phone,phone_e164,whatsapp,whatsapp_e164,status")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(25);
  if (search) {
    const safe = search.replace(/[%_,()]/g, " ").trim();
    if (safe) query = query.or(`display_name.ilike.%${safe}%,client_code.ilike.%${safe}%,phone.ilike.%${safe}%,phone_e164.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data: clients, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = (clients || []).map((client) => client.id);
  const [{ data: subscriptions }, { data: portals }] = ids.length ? await Promise.all([
    admin.from("client_subscriptions").select("client_id,status,service:client_services!client_subscriptions_service_id_fkey(name)").in("client_id", ids),
    admin.from("client_portal_accounts").select("client_id,must_change_password,last_login_at").in("client_id", ids)
  ]) : [{ data: [] }, { data: [] }];

  const result = (clients || []).map((client) => {
    const tracked = (subscriptions || []).filter((subscription) => subscription.client_id === client.id);
    const portal = (portals || []).find((item) => item.client_id === client.id);
    return {
      ...client,
      services: tracked.map((subscription) => {
        const service = subscription.service as unknown as { name?: string } | null;
        return { name: service?.name || "Service", status: subscription.status };
      }),
      portal: portal || null
    };
  });

  return NextResponse.json({ clients: result }, { headers: { "Cache-Control": "no-store" } });
}
