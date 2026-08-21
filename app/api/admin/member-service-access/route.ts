import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RpcError = { message: string } | null;
type RpcResult = { data: unknown; error: RpcError };
type RpcClient = {
  rpc: (functionName: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
};
type AdminAccessRow = {
  service_name?: string | null;
  account_email?: string | null;
  account_password?: string | null;
  profile_name?: string | null;
  profile_pin?: string | null;
};

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("subscriptionId") || "";
  if (!uuidPattern.test(subscriptionId)) {
    return NextResponse.json({ error: "A valid subscription is required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const rpcClient = supabase as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc("uniplug_admin_get_client_service_access", {
    p_client_subscription_id: subscriptionId
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const row = (Array.isArray(data) ? data[0] : null) as AdminAccessRow | null;
  if (!row) return NextResponse.json({ error: "Service access details were not found." }, { status: 404 });

  return NextResponse.json({
    serviceName: row.service_name || "Digital service",
    accountEmail: row.account_email || "",
    accountPassword: row.account_password || "",
    profileName: row.profile_name || "",
    profilePin: row.profile_pin || ""
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || "");
  if (!uuidPattern.test(subscriptionId)) {
    return NextResponse.json({ error: "A valid subscription is required." }, { status: 400 });
  }

  const accountEmail = String(body.accountEmail || "").trim().slice(0, 320);
  const accountPassword = String(body.accountPassword || "").slice(0, 2048);
  const profileName = String(body.profileName || "").trim().slice(0, 160);
  const profilePin = String(body.profilePin || "").trim().slice(0, 128);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const rpcClient = supabase as unknown as RpcClient;
  const { error } = await rpcClient.rpc("uniplug_admin_set_client_service_access", {
    p_client_subscription_id: subscriptionId,
    p_account_email: accountEmail || null,
    p_account_password: accountPassword || null,
    p_profile_name: profileName || null,
    p_profile_pin: profilePin || null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
