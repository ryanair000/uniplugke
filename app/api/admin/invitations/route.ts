import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function cleanUsername(value: unknown, email: string) {
  const supplied = String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
  const fallback = email.split("@")[0].replace(/[^a-z0-9._-]/g, "").slice(0, 24);
  return supplied || fallback;
}

export async function POST(request: Request) {
  const viewer = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const displayName = String(body.displayName || "").trim().slice(0, 100);
  const phone = String(body.phone || "").replace(/[^+\d]/g, "").slice(0, 20) || null;
  let username = cleanUsername(body.username, email);

  if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || username.length < 3) {
    return NextResponse.json({ error: "Valid name, email, and username are required." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Invitation service is not configured." }, { status: 503 });

  const { data: existingProfile } = await admin
    .from("uniplug_profiles")
    .select("user_id,username,status")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.username && !body.username) username = existingProfile.username;
  const { data: usernameOwner } = await admin
    .from("uniplug_profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (usernameOwner && usernameOwner.user_id !== existingProfile?.user_id) {
    return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
  }

  let existingUserId = existingProfile?.user_id || null;
  if (!existingUserId) {
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    existingUserId = usersData.users.find((user) => user.email?.toLowerCase() === email)?.id || null;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop";
  const redirectTo = `${siteUrl}/auth/callback?next=/set-password`;
  const linkType: "invite" | "recovery" = existingUserId ? "recovery" : "invite";
  const linkResult = linkType === "invite"
    ? await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo, data: { display_name: displayName, uniplug_username: username } }
      })
    : await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo }
      });
  const { data: generated, error: linkError } = linkResult;

  if (linkError || !generated.user) {
    return NextResponse.json({ error: linkError?.message || "The invitation link could not be created." }, { status: 400 });
  }

  const status = existingProfile?.status === "active" ? "active" : "pending";
  const { error: profileError } = await admin.from("uniplug_profiles").upsert({
    user_id: generated.user.id,
    email,
    display_name: displayName,
    username,
    phone,
    role: "client",
    status,
    invited_at: new Date().toISOString()
  }, { onConflict: "user_id" });

  if (profileError) {
    return NextResponse.json({ error: "The authentication link was created, but the member profile could not be saved." }, { status: 500 });
  }

  const actionLink = generated.properties?.action_link;
  if (!actionLink) return NextResponse.json({ error: "The authentication provider did not return an invitation link." }, { status: 500 });

  await admin.from("uniplug_invitations").insert({
    user_id: generated.user.id,
    email,
    username,
    display_name: displayName,
    action_type: linkType,
    status: "created",
    invited_by: viewer.user.id,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  return NextResponse.json({
    link: actionLink,
    username,
    email,
    actionType: linkType,
    expiresIn: "24 hours"
  }, { headers: { "Cache-Control": "no-store" } });
}
