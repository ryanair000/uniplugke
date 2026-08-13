import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function signaturesMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const admin = createAdminSupabaseClient();
  if (!secret || !admin) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  if (!signature || !signaturesMatch(signature, expected)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: { reference?: string; amount?: number; status?: string; paid_at?: string; channel?: string };
  };

  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const isKeyOrder = event.data.reference.startsWith("KEY-");
  const table = isKeyOrder ? "uniplug_key_orders" : "uniplug_member_orders";
  const amountColumn = isKeyOrder ? "amount_kes" : "total_kes";
  const { data: order } = await admin
    .from(table)
    .select(`id,${amountColumn},payment_status`)
    .eq("paystack_reference", event.data.reference)
    .maybeSingle();

  if (!order) return NextResponse.json({ received: true });
  const expectedKes = Number("amount_kes" in order ? order.amount_kes : order.total_kes);
  const expectedAmount = Math.round(expectedKes * 100);
  if (event.data.status !== "success" || Number(event.data.amount) !== expectedAmount) {
    await admin.from(table).update({ payment_status: "amount_mismatch", fulfillment_status: "manual_review" }).eq("id", order.id);
    return NextResponse.json({ received: true });
  }

  if (order.payment_status !== "paid") {
    await admin.from(table).update({
      payment_status: "paid",
      fulfillment_status: isKeyOrder ? "pending_delivery" : "pending_activation",
      paid_at: event.data.paid_at || new Date().toISOString()
    }).eq("id", order.id);
  }

  return NextResponse.json({ received: true });
}
