import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getAuthorizedAccessDetails } from "@/lib/client-portal";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "Account is not working").trim().slice(0, 500);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Replacement service is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("uniplug_replace_client_account", {
    p_client_subscription_id: id,
    p_reason: reason || null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (data?.status !== "completed") {
    return NextResponse.json({
      status: data?.status || "no_inventory",
      error: "No matching replacement is currently available. Support has been notified."
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  const access = await getAuthorizedAccessDetails(viewer.user.id, id);
  if ("error" in access) return NextResponse.json({ status: "completed", message: access.error }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ status: "completed", details: access.details }, { headers: { "Cache-Control": "no-store" } });
}
