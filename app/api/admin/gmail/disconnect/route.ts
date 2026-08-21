import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  await requireAdmin();
  const form = await request.formData();
  const accountId = String(form.get("accountId") || "");
  const admin = createAdminSupabaseClient();
  if (admin && accountId) await admin.from("uniplug_gmail_connections").delete().eq("account_id", accountId);
  return NextResponse.redirect(new URL("/admin/mailboxes?success=mailbox_disconnected", request.url), 303);
}
