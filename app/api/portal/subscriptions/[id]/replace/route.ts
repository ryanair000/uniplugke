import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getAuthorizedAccessDetails } from "@/lib/client-portal";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const replacementReasons = new Set(["incorrect_password", "no_subscription", "vpn_issue", "household_issue", "other"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim().toLowerCase();
  if (!replacementReasons.has(reason)) {
    return NextResponse.json({ error: "Choose why you need a replacement." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Replacement service is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("uniplug_replace_client_account", {
    p_client_subscription_id: id,
    p_reason: reason || null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (reason === "household_issue") {
    await createAdminSupabaseClient()?.from("uniplug_household_events").insert({
      user_id: viewer.user.id,
      client_subscription_id: id,
      event_type: "replacement_requested",
      outcome: data?.status || "unknown"
    });
  }
  if (data?.status === "approval_required") {
    return NextResponse.json({
      status: "approval_required",
      requestId: data.requestId,
      message: "An administrator approval request is now pending."
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
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

