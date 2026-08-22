import type { SupabaseClient } from "@supabase/supabase-js";

function vercelPreviewOrigin() {
  if (process.env.VERCEL_ENV !== "preview") return null;
  const deploymentHost = process.env.VERCEL_URL?.trim();
  return deploymentHost ? `https://${deploymentHost}` : null;
}

export const STORE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop";
export const VIP_ORIGIN = vercelPreviewOrigin() || process.env.NEXT_PUBLIC_VIP_SITE_URL || "https://vip.uniplug.shop";

export type LokimaxVipAccess = {
  clientId: string | null;
  hasService: boolean;
  mustChangePassword: boolean;
};

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {} as Record<string, unknown>;
}

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

  // Do not pin this query to portal.client_id. The portal RLS policy exposes
  // every visible subscription in the same canonical LokiMax client family,
  // including subscriptions that still live on a historical alias row.
  const { data: subscriptions, error } = await supabase
    .from("client_subscriptions")
    .select("id,status,metadata")
    .in("status", ["active", "due_soon", "trial"])
    .limit(500);

  const hasService = !error && (subscriptions || []).some((subscription) => {
    const metadata = metadataObject(subscription.metadata);
    return metadata.portal_hidden !== true && metadata.interest_only !== true;
  });

  return {
    clientId: portal.client_id,
    hasService,
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
