import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { encryptRefreshToken, exchangeGmailAuthorizationCode, verifyGmailOAuthState } from "@/lib/gmail";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function destination(request: NextRequest, key: "error" | "success", value: string) {
  return NextResponse.redirect(new URL(`/admin/mailboxes?${key}=${encodeURIComponent(value)}`, request.url));
}

export async function GET(request: NextRequest) {
  const viewer = await requireAdmin();
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = verifyGmailOAuthState(request.nextUrl.searchParams.get("state") || "");
  if (!code || !state || state.userId !== viewer.user.id) return destination(request, "error", "invalid_oauth_state");
  const admin = createAdminSupabaseClient();
  if (!admin) return destination(request, "error", "server_not_configured");
  try {
    const tokens = await exchangeGmailAuthorizationCode(code, request.nextUrl.origin);
    if (!tokens.refresh_token) return destination(request, "error", "refresh_token_missing");
    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
    const profile = await profileResponse.json() as { emailAddress?: string };
    const { data: account } = await admin.from("accounts").select("id,account_mail").eq("id", state.accountId).maybeSingle();
    if (!profileResponse.ok || !account || profile.emailAddress?.toLowerCase() !== account.account_mail.toLowerCase()) {
      return destination(request, "error", "mailbox_mismatch");
    }
    const { error } = await admin.from("uniplug_gmail_connections").upsert({
      account_id: account.id,
      mailbox_email: account.account_mail,
      encrypted_refresh_token: encryptRefreshToken(tokens.refresh_token),
      connected_by: viewer.user.id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null
    }, { onConflict: "account_id" });
    if (error) throw error;
    return destination(request, "success", "mailbox_connected");
  } catch (error) {
    return destination(request, "error", error instanceof Error ? error.message.slice(0, 120) : "gmail_connection_failed");
  }
}
