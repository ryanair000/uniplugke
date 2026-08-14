import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    return new NextResponse(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="20" fill="#c8f05c"/><path d="M23 21v14c0 6 3.5 9 9 9s9-3 9-9V21h-7v14c0 2.2-.7 3.2-2 3.2s-2-1-2-3.2V21h-7Z" fill="#0b2149"/></svg>',
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
