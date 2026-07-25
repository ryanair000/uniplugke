"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requestSubscriptionAction(formData: FormData) {
  await requireMember();
  const subscriptionId = String(formData.get("subscriptionId") || "");
  const requestType = String(formData.get("requestType") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 1000);
  if (!uuidPattern.test(subscriptionId) || !["pause", "cancel"].includes(requestType)) {
    redirect("/dashboard?error=invalid_subscription_request");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(`/dashboard/subscriptions/${subscriptionId}?error=not_configured`);
  const { error } = await supabase.rpc("uniplug_request_subscription_action", {
    p_subscription_id: subscriptionId,
    p_request_type: requestType,
    p_reason: reason || null
  });
  if (error) redirect(`/dashboard/subscriptions/${subscriptionId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/subscriptions/${subscriptionId}`);
  revalidatePath("/admin");
  redirect(`/dashboard/subscriptions/${subscriptionId}?success=request_submitted`);
}
