import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getAuthorizedAccessDetails } from "@/lib/client-portal";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const result = await getAuthorizedAccessDetails(viewer.user.id, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result.details, { headers: { "Cache-Control": "no-store" } });
}
