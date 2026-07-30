import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

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

  let email = identifier;
  if (!identifier.includes("@")) {
    const admin = createAdminSupabaseClient();
    if (!admin) return NextResponse.json({ error: "Member login is not configured." }, { status: 503 });
    const { data: profile } = await admin
      .from("uniplug_profiles")
      .select("email")
      .eq("username", identifier)
      .maybeSingle();
    if (!profile?.email) return genericFailure();
    email = profile.email;
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

  const destination = profile?.status === "pending" ? "/set-password" : safeNext(body.next);
  return NextResponse.json(
    { next: destination },
    { headers: { "Cache-Control": "no-store" } }
  );
}
