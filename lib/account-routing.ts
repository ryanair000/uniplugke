import type { SupabaseClient } from "@supabase/supabase-js";

export const STORE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop";
export const VIP_ORIGIN = process.env.NEXT_PUBLIC_VIP_SITE_URL || "https://vip.uniplug.shop";

export type LokimaxVipAccess = {
  clientId: string | null;
  hasService: boolean;
  mustChangePassword: boolean;
};

export async function getLokimaxVipAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<LokimaxVipAccess> {
  const { data: portal } = await supabase
    .from("client_portal_accounts")
    .select("client_id,must_change_password")
    .eq("user_id", userId)
    .maybeSingle();

  if (!portal?.client_id) {
    return { clientId: null, hasService: false, mustChangePassword: false };
  }

  const { count, error } = await supabase
    .from("client_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", portal.client_id);

  return {
    clientId: portal.client_id,
    hasService: !error && Boolean(count),
    mustChangePassword: Boolean(portal.must_change_password)
  };
}

function absoluteUrl(origin: string, pathname: string) {
  return new URL(pathname, origin.endsWith("/") ? origin : `${origin}/`).toString();
}

function vipPath(nextPath: string) {
  if (nextPath === "/tools/verify" || nextPath.startsWith("/dashboard") || nextPath.startsWith("/admin")) return nextPath;
  return "/dashboard";
}

export function vipAccountDestination(mustChangePassword = false, nextPath = "/dashboard") {
  if (mustChangePassword) {
    return absoluteUrl(VIP_ORIGIN, "/dashboard/settings?security=required");
  }
  return absoluteUrl(VIP_ORIGIN, vipPath(nextPath));
}

export function storeAccountDestination(nextPath = "/") {
  const allowedPath = nextPath === "/checkout" || nextPath.startsWith("/checkout?")
    ? nextPath
    : "/";
  return absoluteUrl(STORE_ORIGIN, allowedPath);
}
