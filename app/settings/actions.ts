"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

function settingsUrl(type: "success" | "error", message: string) {
  return `/dashboard/settings?${type}=${encodeURIComponent(message)}`;
}

export async function updateMemberProfile(formData: FormData) {
  await requireMember();
  const displayName = String(formData.get("displayName") || "").trim().slice(0, 100);
  const username = String(formData.get("username") || "").trim().toLowerCase().slice(0, 32);
  const phone = String(formData.get("phone") || "").replace(/[^+\d]/g, "").slice(0, 20);
  const renewalRemindersEnabled = formData.get("renewalRemindersEnabled") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(settingsUrl("error", "Account settings are not configured."));

  const { error } = await supabase.rpc("uniplug_update_member_profile", {
    p_display_name: displayName || null,
    p_username: username,
    p_phone: phone || null,
    p_renewal_reminders_enabled: renewalRemindersEnabled,
    p_marketing_opt_in: marketingOptIn
  });
  if (error) redirect(settingsUrl("error", error.message));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect(settingsUrl("success", "Profile settings updated."));
}

export async function updateMemberPassword(formData: FormData) {
  const viewer = await requireMember();
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("passwordConfirmation") || "");
  if (password.length < 10) redirect(settingsUrl("error", "Use a password with at least 10 characters."));
  if (password !== confirmation) redirect(settingsUrl("error", "The new passwords do not match."));

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(settingsUrl("error", "Password updates are not configured."));

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) redirect(settingsUrl("error", passwordError.message));

  // Clearing the forced-rotation flag is intentionally service-role only.
  // A browser bearer token cannot mark its own temporary password as rotated.
  const admin = createAdminSupabaseClient();
  if (!admin) {
    redirect(settingsUrl("error", "Your password changed, but account security could not be finalized. Please try again."));
  }

  const { error: portalError } = await admin
    .from("client_portal_accounts")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("user_id", viewer.user.id);
  if (portalError) {
    redirect(settingsUrl("error", "Your password changed, but account security could not be finalized. Please try again."));
  }

  const { error: eventError } = await admin.from("uniplug_member_events").insert({
    user_id: viewer.user.id,
    event_type: "password_updated",
    title: "Private password updated",
    detail: "Your UniPlug sign-in password was changed.",
    entity_type: "profile",
    entity_id: viewer.user.id
  });
  if (eventError) {
    console.error("[uniplug-password] could not record password-update event");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  redirect(settingsUrl("success", "Private password updated."));
}
