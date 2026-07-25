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

  const { data: profile } = await supabase
    .from("uniplug_profiles")
    .select("user_id,email,display_name,username,role,status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return {
    user: data.user,
    profile: profile
      ? ({
          userId: profile.user_id,
          email: profile.email,
          displayName: profile.display_name,
          username: profile.username,
          role: profile.role,
          status: profile.status
        } as MemberProfile)
      : null
  };
});

export async function requireMember() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/login");
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
