import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    return new NextResponse(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="13" fill="#fff"/><path fill="#155EEF" d="M9 22h13v20a10 10 0 0 0 20 0V22h13v20a23 23 0 0 1-46 0V22Z"/><rect width="10" height="18" x="14" y="3" rx="2" fill="#155EEF"/><rect width="10" height="18" x="40" y="3" rx="2" fill="#155EEF"/><rect width="16" height="7" x="24" y="22" rx="2" fill="#B8F500"/></svg>',
      {
        headers: {
          "Cache-Control": "public, max-age=86400, immutable",
          "Content-Type": "image/svg+xml",
        },
      },
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
