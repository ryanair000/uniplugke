import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isKeysHostname } from "@/lib/site-mode";

const publicPaths = new Set([
  "/login",
  "/set-password",
  "/auth/callback",
  "/api/auth/login",
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
    const allowed = pathname === "/" || pathname === "/checkout" || pathname === "/payment-return" || pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/api/keys/checkout" || pathname === "/api/payments/verify" || pathname === "/api/payments/webhook";
    if (!allowed) {
      const storeUrl = request.nextUrl.clone(); storeUrl.pathname = "/"; storeUrl.search = "";
      return NextResponse.redirect(storeUrl);
    }
    return NextResponse.next({ request });
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
  if (isCatalogPath) return response;
  if (isPublicPath) return securePrivateResponse(response);

  if (!data.user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithCookies(response, loginUrl);
  }

  const { data: profile } = await supabase
    .from("uniplug_profiles")
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profile?.status !== "active") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", "membership_required");
    return redirectWithCookies(response, loginUrl);
  }

  return securePrivateResponse(response);
}
