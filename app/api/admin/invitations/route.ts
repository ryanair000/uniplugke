import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { provisionPortalAccount } from "@/lib/portal-provisioning";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const viewer = await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const selectedClientId = String(body.clientId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(selectedClientId)) {
    return NextResponse.json({ error: "Select a valid tracked client." }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Invitation service is not configured." }, { status: 503 });

  try {
    const result = await provisionPortalAccount(admin, selectedClientId, {
      initiatedBy: viewer.user.id,
      recordInvitation: true,
      resetCredentials: true
    });
    const loginUrl = `${process.env.NEXT_PUBLIC_VIP_SITE_URL || "https://vip.uniplug.shop"}/login`;
    const message = [
      `Hello ${result.displayName}, your UniPlug client dashboard is ready.`,
      result.services.length ? `Services already linked: ${result.services.join(", ")}.` : "Your tracked services are linked to your account.",
      `Login: ${loginUrl}`,
      `Username: ${result.username}`,
      ...(result.phone ? [`Phone: ${result.phone}`] : []),
      `Temporary password: ${result.temporaryPassword}`,
      "You will be required to choose a private password immediately after signing in.",
      "Account replacement requests require administrator approval."
    ].join("\n");

    return NextResponse.json({
      clientId: result.clientId,
      selectedClientId: result.selectedClientId,
      displayName: result.displayName,
      phone: result.phone,
      temporaryPassword: result.temporaryPassword,
      username: result.username,
      serviceCount: result.serviceCount,
      services: result.services,
      actionType: result.actionType,
      loginUrl,
      message,
      whatsappUrl: result.phone ? `https://wa.me/${result.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal member could not be prepared.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
