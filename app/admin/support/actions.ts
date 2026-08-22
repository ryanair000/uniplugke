"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedStatuses = new Set(["in_progress", "waiting_customer", "resolved"]);

export async function replyToSupportTicket(formData: FormData) {
  const viewer = await requireAdmin();
  const ticketId = String(formData.get("ticketId") || "");
  const message = String(formData.get("message") || "").trim().slice(0, 4000);
  const status = String(formData.get("status") || "waiting_customer");
  if (!uuidPattern.test(ticketId) || message.length < 1 || !allowedStatuses.has(status)) {
    throw new Error("A valid ticket, reply, and status are required");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: ticket } = await supabase
    .from("uniplug_support_tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw new Error("Support ticket not found");

  const { error: replyError } = await supabase.from("uniplug_support_messages").insert({
    ticket_id: ticketId,
    sender_id: viewer.user.id,
    sender_role: "admin",
    body: message
  });
  if (replyError) throw new Error(replyError.message);

  const resolved = status === "resolved";
  const { error: statusError } = await supabase
    .from("uniplug_support_tickets")
    .update({
      status,
      admin_note: message.slice(0, 2000),
      resolved_by: resolved ? viewer.user.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", ticketId);
  if (statusError) throw new Error(statusError.message);

  revalidatePath("/admin/support");
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard/support");
  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/dashboard/notifications");
  redirect(`/admin/support?ticket=${ticketId}&success=reply_sent`);
}
