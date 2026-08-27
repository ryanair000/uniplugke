import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { retrieveVerifyCode, verifyRequestIpHash } from "@/lib/verify";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const result = await retrieveVerifyCode({
    action: "household_update",
    authenticatedAt: viewer.user.last_sign_in_at,
    clientId: viewer.profile.clientId,
    ipHash: verifyRequestIpHash(request),
    subscriptionId: id,
    userId: viewer.user.id
  });
  const headers: Record<string, string> = { ...noStore };
  if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
  return NextResponse.json(result.body, { status: result.status, headers });
}
