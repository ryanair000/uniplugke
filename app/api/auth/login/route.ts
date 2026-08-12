import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeKenyanPhone } from "@/lib/phone";

function safeNext(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function cleanIdentifier(value: unknown) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

async function genericFailure() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return NextResponse.json(
    { error: "The username/email or password is incorrect." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier = cleanIdentifier(body.identifier);
  const password = String(body.password || "");
  if (!identifier || password.length < 8 || password.length > 256) return genericFailure();

  const admin = createAdminSupabaseClient();

  let email = identifier;
  let resolvedUserId: string | null = null;
  if (admin) {
    const phone = normalizeKenyanPhone(identifier);
    if (phone) {
      const { data: portal } = await admin
        .from("client_portal_accounts")
        .select("user_id")
        .eq("phone_e164", phone)
        .maybeSingle();
      resolvedUserId = portal?.user_id || null;
    } else {
      const profileQuery = identifier.includes("@")
        ? admin.from("uniplug_profiles").select("user_id").eq("email", identifier).maybeSingle()
        : admin.from("uniplug_profiles").select("user_id").eq("username", identifier).maybeSingle();
      const { data: profile } = await profileQuery;
      resolvedUserId = profile?.user_id || null;
      if (!resolvedUserId && identifier.includes("@")) {
        const { data: client } = await admin.from("clients").select("id").eq("email", identifier).is("deleted_at", null).maybeSingle();
        if (client) {
          const { data: portal } = await admin.from("client_portal_accounts").select("user_id").eq("client_id", client.id).maybeSingle();
          resolvedUserId = portal?.user_id || null;
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
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!profile || !["active", "pending"].includes(profile.status)) {
    await supabase.auth.signOut();
    return genericFailure();
  }

  let mustChangePassword = false;
  if (admin) {
    const { data: portal } = await admin
      .from("client_portal_accounts")
      .select("must_change_password")
      .eq("user_id", data.user.id)
      .maybeSingle();
    mustChangePassword = Boolean(portal?.must_change_password);
    await admin.from("client_portal_accounts")
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", data.user.id);
  }

  const destination = profile?.status === "pending" || mustChangePassword
    ? "/set-password"
    : safeNext(body.next);
  return NextResponse.json(
    { next: destination },
    { headers: { "Cache-Control": "no-store" } }
  );
}
