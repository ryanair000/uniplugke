import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { getTrackedSubscription } from "@/lib/client-portal";
import { findLatestNetflixCodeWithAppPassword } from "@/lib/gmail";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  if (!viewer.profile.clientId) return NextResponse.json({ error: "This service is not linked to a managed account." }, { status: 404, headers: noStore });
  const subscription = await getTrackedSubscription(viewer.profile.clientId, id);
  const name = subscription?.service?.name || subscription?.serviceIdentifier || "";
  if (!subscription || !name.toLowerCase().includes("netflix")) return NextResponse.json({ error: "Household help is available only for Netflix." }, { status: 404, headers: noStore });
  const supabase = await createServerSupabaseClient();
  if (!supabase || !process.env.GMAIL_TOKEN_ENCRYPTION_KEY) return NextResponse.json({ error: "Code retrieval is not configured." }, { status: 503, headers: noStore });

  const { data: row } = await supabase.from("client_subscriptions").select("account_reference").eq("id", id).eq("client_id", viewer.profile.clientId).maybeSingle();
  const mailboxEmail = row?.account_reference?.trim().toLowerCase();
  if (!mailboxEmail) {
    return NextResponse.json({ status: "not_connected", error: "This Netflix mailbox is not connected yet. Create a ticket for help." }, { status: 409, headers: noStore });
  }

  const { data: connection } = await supabase.from("uniplug_mailbox_credentials").select("encrypted_app_password").eq("mailbox_email", mailboxEmail).maybeSingle();
  if (!connection) {
    return NextResponse.json({ status: "not_connected", error: "This Netflix mailbox is not connected yet. Create a ticket for help." }, { status: 409, headers: noStore });
  }

  try {
    const result = await findLatestNetflixCodeWithAppPassword(mailboxEmail, connection.encrypted_app_password);
    if (!result) {
      return NextResponse.json({ status: "not_found", error: "No new code was found. On Netflix choose Send Email, then check again." }, { status: 404, headers: noStore });
    }
    return NextResponse.json({ status: "ready", ...result }, { headers: noStore });
  } catch (error) {
    console.error("Netflix mailbox check failed", { mailbox: mailboxEmail, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Netflix email could not be checked. Confirm the mailbox connection or create a support ticket." }, { status: 502, headers: noStore });
  }
}
