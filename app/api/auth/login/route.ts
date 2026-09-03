import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeKenyanPhone } from "@/lib/phone";
import { findPortalUserForClient } from "@/lib/client-identity";
import { isKeysHostname } from "@/lib/site-mode";
import {
  getLokimaxVipAccess,
  storeAccountDestination,
  vipAccountDestination
} from "@/lib/account-routing";

function safeNext(value: unknown) {
  const path = String(value || "/dashboard/subscriptions");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard/subscriptions";
}

function cleanIdentifier(value: unknown) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function fingerprint(prefix: string, value: string) {
  return createHash("sha256").update(`${prefix}:${value}`).digest("hex");
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

async function genericFailure() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return NextResponse.json(
    { error: "The username/email or password is incorrect." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

function rateLimitFailure() {
  return NextResponse.json(
    { error: "Too many sign-in attempts. Try again shortly." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "600"
      }
    }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier = cleanIdentifier(body.identifier);
  const password = String(body.password || "");
  if (!identifier || password.length < 8 || password.length > 256) return genericFailure();

  const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isVipHost = !isKeysHostname(requestHost);
  const admin = createAdminSupabaseClient();

  if (admin) {
    const ipKey = fingerprint("uniplug-login-ip", requestIp(request));
    const identifierKey = fingerprint("uniplug-login-identifier", identifier);
    const [ipLimit, identifierLimit] = await Promise.all([
      admin.rpc("check_rate_limit", {
        p_fingerprint: ipKey,
        p_route: "uniplug_login_ip",
        p_limit: 40,
        p_window_seconds: 600
      }),
      admin.rpc("check_rate_limit", {
        p_fingerprint: identifierKey,
        p_route: "uniplug_login_identifier",
        p_limit: 10,
        p_window_seconds: 600
      })
    ]);

    if (ipLimit.error || identifierLimit.error) {
      console.error("[uniplug-login] rate limiter unavailable");
      return NextResponse.json(
        { error: "Sign-in is temporarily unavailable. Please try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (ipLimit.data !== true || identifierLimit.data !== true) return rateLimitFailure();
  }

  let email = identifier;
  let resolvedUserId: string | null = null;
  if (admin) {
    const phone = normalizeKenyanPhone(identifier);
    if (phone) {
      const { data: directPortal } = await admin
        .from("client_portal_accounts")
        .select("user_id")
        .eq("phone_e164", phone)
        .maybeSingle();
      resolvedUserId = directPortal?.user_id || null;

      // Older LokiMax rows can hold the member phone on an alias client while
      // the portal account is attached to the canonical client. Resolve those
      // candidate client rows through the shared identity graph before giving up.
      if (!resolvedUserId) {
        const localKenyan = phone.startsWith("+254") ? `0${phone.slice(4)}` : null;
        const digits = phone.replace(/\D/g, "");
        const filters = [
          `phone_e164.eq.${phone}`,
          `whatsapp_e164.eq.${phone}`,
          `phone.eq.${phone}`,
          `whatsapp.eq.${phone}`,
          `phone.eq.${digits}`,
          `whatsapp.eq.${digits}`,
          ...(localKenyan ? [`phone.eq.${localKenyan}`, `whatsapp.eq.${localKenyan}`] : [])
        ];
        const { data: clients } = await admin
          .from("clients")
          .select("id")
          .is("deleted_at", null)
          .or(filters.join(","))
          .limit(12);
        for (const client of clients || []) {
          resolvedUserId = await findPortalUserForClient(admin, client.id);
          if (resolvedUserId) break;
        }
      }
    } else {
      const profileQuery = identifier.includes("@")
        ? admin.from("uniplug_profiles").select("user_id").eq("email", identifier).maybeSingle()
        : admin.from("uniplug_profiles").select("user_id").eq("username", identifier).maybeSingle();
      const { data: profile } = await profileQuery;
      resolvedUserId = profile?.user_id || null;

      if (!resolvedUserId && identifier.includes("@")) {
        const { data: clients } = await admin
          .from("clients")
          .select("id")
          .eq("email", identifier)
          .is("deleted_at", null)
          .limit(12);
        for (const client of clients || []) {
          resolvedUserId = await findPortalUserForClient(admin, client.id);
          if (resolvedUserId) break;
        }
      }
    }
  } else if (!identifier.includes("@")) {
    const phone = normalizeKenyanPhone(identifier);
    email = phone
      ? `${phone.replace(/^\+254/, "0")}@members.uniplug.shop`
      : `${identifier}@members.uniplug.shop`;
  }

  if (resolvedUserId && admin) {
    const { data: authUser } = await admin.auth.admin.getUserById(resolvedUserId);
    if (!authUser.user?.email) return genericFailure();
    email = authUser.user.email;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Member login is not configured." }, { status: 503 });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return genericFailure();

  const { data: profile } = await supabase
    .from("uniplug_profiles")
    .select("status,role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!profile || !["active", "pending"].includes(profile.status)) {
    await supabase.auth.signOut();
    return genericFailure();
  }

  let vipAccess = await getLokimaxVipAccess(supabase, data.user.id);
  const firstLogin = profile.status === "pending" || vipAccess.mustChangePassword;
  if (firstLogin) {
    const { error: onboardingError } = await supabase.rpc("uniplug_complete_onboarding");
    if (onboardingError) {
      return NextResponse.json(
        { error: "Your account is signed in, but the dashboard could not be prepared. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    vipAccess = await getLokimaxVipAccess(supabase, data.user.id);
  }

  if (admin) {
    await admin.from("client_portal_accounts")
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", data.user.id);
  }

  const requestedPath = safeNext(body.next);
  const isAdmin = profile.role === "admin";
  const mustRotatePassword = !isAdmin && vipAccess.mustChangePassword;
  const destination = isVipHost || vipAccess.hasService || isAdmin
    ? vipAccountDestination(
        mustRotatePassword,
        firstLogin && !isAdmin ? "/dashboard/subscriptions" : requestedPath
      )
    : storeAccountDestination(requestedPath);
  return NextResponse.json(
    { next: destination },
    { headers: { "Cache-Control": "no-store" } }
  );
}
