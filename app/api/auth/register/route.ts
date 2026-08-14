import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { STORE_ORIGIN, storeAccountDestination } from "@/lib/account-routing";

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function cleanDisplayName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const displayName = cleanDisplayName(body.displayName);
  const password = String(body.password || "");

  if (!displayName || !email.includes("@") || password.length < 8 || password.length > 256) {
    return NextResponse.json(
      { error: "Enter your name, a valid email, and a password with at least 8 characters." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Account registration is temporarily unavailable." }, { status: 503 });
  }

  const callbackUrl = new URL("/auth/callback", STORE_ORIGIN);
  callbackUrl.searchParams.set("next", "/");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: callbackUrl.toString()
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const isNewIdentity = Boolean(data.user?.identities?.length);
  if (data.user && isNewIdentity) {
    const username = `shop-${data.user.id.replaceAll("-", "").slice(0, 16)}`;
    const { error: profileError } = await admin.from("uniplug_profiles").insert({
      user_id: data.user.id,
      email,
      display_name: displayName,
      username,
      role: "client",
      status: "active",
      onboarding_completed_at: new Date().toISOString()
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { error: "Your account could not be created. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  return NextResponse.json({
    next: storeAccountDestination("/"),
    signedIn: Boolean(data.session),
    message: data.session
      ? "Your account is ready."
      : "Check your email to confirm your account, then sign in."
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
