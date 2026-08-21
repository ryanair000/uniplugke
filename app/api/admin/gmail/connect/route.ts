import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { gmailAuthorizationUrl, hasGmailOAuthConfig } from "@/lib/gmail";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const viewer = await requireAdmin();
  const accountId = request.nextUrl.searchParams.get("accountId") || "";
  if (!uuidPattern.test(accountId)) return NextResponse.redirect(new URL("/admin/mailboxes?error=invalid_account", request.url));
  if (!hasGmailOAuthConfig()) return NextResponse.redirect(new URL("/admin/mailboxes?error=oauth_not_configured", request.url));
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.redirect(new URL("/admin/mailboxes?error=server_not_configured", request.url));
  const { data: account } = await admin.from("accounts").select("id,account_mail,service_name,game").eq("id", accountId).maybeSingle();
  const service = `${account?.service_name || ""} ${account?.game || ""}`.toLowerCase();
  if (!account || !service.includes("netflix")) return NextResponse.redirect(new URL("/admin/mailboxes?error=netflix_only", request.url));
  return NextResponse.redirect(gmailAuthorizationUrl({ accountId, email: account.account_mail, origin: request.nextUrl.origin, userId: viewer.user.id }));
}
