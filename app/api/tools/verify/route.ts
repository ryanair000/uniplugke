import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { retrieveVerifyCode, verifyRequestIpHash } from "@/lib/verify";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request) {
  const viewer = await requireMember();
  const body = await request.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || "");
  if (!uuidPattern.test(subscriptionId)) {
    return NextResponse.json({ error: "Choose a valid service and try again." }, { status: 400, headers: noStore });
  }

  const result = await retrieveVerifyCode({
    authenticatedAt: viewer.user.last_sign_in_at,
    clientId: viewer.profile.clientId,
    ipHash: verifyRequestIpHash(request),
    subscriptionId,
    userId: viewer.user.id
  });
  const headers: Record<string, string> = { ...noStore };
  if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
  return NextResponse.json(result.body, { status: result.status, headers });
}
