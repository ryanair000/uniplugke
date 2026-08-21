"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createSupportTicket(formData: FormData) {
  const viewer = await requireMember();
  const subject = String(formData.get("subject") || "").trim().slice(0, 120);
  const message = String(formData.get("message") || "").trim().slice(0, 2000);
  const returnTo = String(formData.get("returnTo") || "") === "/dashboard/support" ? "/dashboard/support" : "/help";
  if (subject.length < 3 || message.length < 10) redirect(`${returnTo}?error=invalid_ticket`);

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`${returnTo}?error=not_configured`);
  const { error } = await supabase.from("uniplug_support_tickets").insert({
    user_id: viewer.user.id,
    subject,
    message
  });
  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/help");
  revalidatePath("/dashboard/support");
  revalidatePath("/admin/requests");
  redirect(`${returnTo}?success=ticket_created`);
}
