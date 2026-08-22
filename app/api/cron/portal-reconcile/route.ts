import { timingSafeEqual } from "node:crypto";
import { reconcileEligiblePortalAccounts } from "@/lib/portal-provisioning";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return Response.json({ error: "Admin database client unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
  const result = await reconcileEligiblePortalAccounts(admin, {
    dryRun,
    limit: Number.isFinite(requestedLimit) ? requestedLimit : 50
  });

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
