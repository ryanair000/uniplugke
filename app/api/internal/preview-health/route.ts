import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

// Preview-only health check used to verify VIP routing and backend readiness before promotion.
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasPublishableKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const admin = createAdminSupabaseClient();
  let rateLimiter = "not_checked";

  if (admin) {
    const { error } = await admin.rpc("check_rate_limit", {
      p_fingerprint: "preview-health-check",
      p_route: "preview_health",
      p_limit: 1000,
      p_window_seconds: 60
    });
    rateLimiter = error ? "error" : "ok";
  }

  return NextResponse.json(
    {
      mode: "vip-preview",
      supabase: {
        url: hasUrl,
        publishableKey: hasPublishableKey,
        serviceRole: hasServiceRole
      },
      rateLimiter
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
