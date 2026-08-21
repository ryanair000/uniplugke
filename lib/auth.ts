import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MemberProfile } from "@/lib/types";

export const getViewer = cache(async () => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { user: null, profile: null as MemberProfile | null };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, profile: null as MemberProfile | null };

  const expanded = await supabase
    .from("uniplug_profiles")
    .select("user_id,email,display_name,username,phone,role,status,renewal_reminders_enabled,marketing_opt_in")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const fallback = expanded.error
    ? await supabase
        .from("uniplug_profiles")
        .select("user_id,email,display_name,username,phone,role,status")
        .eq("user_id", data.user.id)
        .maybeSingle()
    : null;
  const profile = expanded.data || fallback?.data;

  const portal = await supabase
    .from("client_portal_accounts")
    .select("client_id,must_change_password,contact_email")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return {
    user: data.user,
    profile: profile
      ? ({
          userId: profile.user_id,
          email: portal.data?.contact_email || profile.email,
          displayName: profile.display_name,
          username: profile.username,
          phone: profile.phone,
          role: profile.role,
          status: profile.status,
          renewalRemindersEnabled: "renewal_reminders_enabled" in profile ? profile.renewal_reminders_enabled ?? true : true,
          marketingOptIn: "marketing_opt_in" in profile ? profile.marketing_opt_in ?? false : false,
          clientId: portal.data?.client_id || null,
          mustChangePassword: portal.data?.must_change_password ?? false
        } as MemberProfile)
      : null
  };
});

export async function requireMember() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/login");
  if (viewer.profile && (viewer.profile.status === "pending" || viewer.profile.mustChangePassword)) {
    const supabase = await createServerSupabaseClient();
    const { error } = supabase
      ? await supabase.rpc("uniplug_complete_onboarding")
      : { error: new Error("Member access is not configured.") };
    if (error) throw new Error(`Member dashboard onboarding failed: ${error.message}`);
    viewer.profile.status = "active";
    viewer.profile.mustChangePassword = false;
  }
  if (!viewer.profile || viewer.profile.status !== "active") {
    redirect("/login?error=membership_required");
  }
  return viewer as { user: NonNullable<typeof viewer.user>; profile: MemberProfile };
}

export async function requireAdmin() {
  const viewer = await requireMember();
  if (viewer.profile.role !== "admin") redirect("/dashboard");
  return viewer;
}
