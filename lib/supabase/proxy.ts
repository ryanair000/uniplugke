import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isKeysHostname } from "@/lib/site-mode";
import { authCookieOptionsForHostname } from "@/lib/auth-cookie";
import {
  getLokimaxVipAccess,
  storeAccountDestination,
  vipAccountDestination
} from "@/lib/account-routing";

const publicPaths = new Set([
  "/login",
  "/register",
  "/set-password",
  "/auth/callback",
  "/auth/member-link",
  "/api/auth/login",
  "/api/auth/register",
  "/api/payments/webhook",
  "/robots.txt"
]);

function isPublicCatalogPath(pathname: string) {
  return pathname === "/" || pathname === "/services" || pathname.startsWith("/services/");
}

function redirectWithCookies(response: NextResponse, destination: URL) {
  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function securePrivateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (isKeysHostname(host)) {
    if (pathname === "/tools/verify") {
      return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, vipAccountDestination(false, pathname)));
    }
    const allowed = pathname === "/" || pathname.startsWith("/keys/") || pathname.startsWith("/products/") || pathname === "/cart" || pathname === "/order-status" || pathname === "/login" || pathname === "/register" || pathname === "/auth/callback" || pathname === "/checkout" || pathname === "/payment-return" || pathname === "/opengraph-image" || pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/api/auth/login" || pathname === "/api/auth/register" || pathname === "/api/store/products" || pathname === "/api/store/checkout" || pathname === "/api/keys/checkout" || pathname === "/api/keys/requests" || pathname === "/api/keys/order-status" || pathname === "/api/payments/verify" || pathname === "/api/payments/webhook";
    if (!allowed) {
      const storeUrl = request.nextUrl.clone(); storeUrl.pathname = "/"; storeUrl.search = "";
      return NextResponse.redirect(storeUrl);
    }
    if (pathname !== "/" || !url || !key) return NextResponse.next({ request });

    let storeResponse = NextResponse.next({ request });
    const storeSupabase = createServerClient(url, key, {
      cookieOptions: authCookieOptionsForHostname(host),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          storeResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            storeResponse.cookies.set(name, value, options)
          );
        }
      }
    });
    const { data: storeUser } = await storeSupabase.auth.getUser();
    if (!storeUser.user) return storeResponse;
    const { data: storeProfile } = await storeSupabase
      .from("uniplug_profiles")
      .select("status,role")
      .eq("user_id", storeUser.user.id)
      .maybeSingle();
    if (storeProfile?.status !== "active") return storeResponse;
    const vipAccess = await getLokimaxVipAccess(storeSupabase, storeUser.user.id);
    if (storeProfile.role !== "admin" && !vipAccess.hasService && !vipAccess.mustChangePassword) return storeResponse;
    return redirectWithCookies(storeResponse, new URL(vipAccountDestination(vipAccess.mustChangePassword)));
  }
  const isPublicPath = publicPaths.has(pathname);
  const isCatalogPath = isPublicCatalogPath(pathname);

  if (!url || !key) {
    if (isCatalogPath) return NextResponse.next({ request });
    if (isPublicPath) return securePrivateResponse(NextResponse.next({ request }));
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", "not_configured");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptionsForHostname(host),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const { data } = await supabase.auth.getUser();

  let profile: { status: string; role: string } | null = null;
  if (data.user) {
    const result = await supabase
      .from("uniplug_profiles")
      .select("status,role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    profile = result.data;

    if (profile?.status === "active" && profile.role !== "admin") {
      const vipAccess = await getLokimaxVipAccess(supabase, data.user.id);
      if (!vipAccess.hasService && !vipAccess.mustChangePassword) {
        return redirectWithCookies(response, new URL(storeAccountDestination("/")));
      }
    }
  }

  if (isCatalogPath) return response;
  if (isPublicPath) return securePrivateResponse(response);

  if (!data.user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithCookies(response, loginUrl);
  }

  if (profile?.status !== "active") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", "membership_required");
    return redirectWithCookies(response, loginUrl);
  }

  return securePrivateResponse(response);
}
