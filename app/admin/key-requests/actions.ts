"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const statuses = new Set(["new", "reviewing", "quoted", "sourced", "closed"]);

export async function updateKeyRequest(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId") || "");
  const status = String(formData.get("status") || "");
  const adminNote = String(formData.get("adminNote") || "").trim().slice(0, 2000) || null;
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !statuses.has(status)) redirect("/admin/key-requests?error=invalid_request");
  const admin = createAdminSupabaseClient();
  if (!admin) redirect("/admin/key-requests?error=not_configured");
  const { error } = await admin.from("uniplug_key_requests").update({ status, admin_note: adminNote, updated_at: new Date().toISOString() }).eq("id", requestId);
  if (error) redirect("/admin/key-requests?error=update_failed");
  revalidatePath("/admin/key-requests");
  redirect("/admin/key-requests?success=request_updated");
}
