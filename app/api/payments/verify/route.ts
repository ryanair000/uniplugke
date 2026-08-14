import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference")?.trim() || "";
  if (!/^(?:UP|KEY)-[A-Z0-9-]{12,80}$/.test(reference)) return NextResponse.json({ paid: false, error: "Invalid payment reference" }, { status: 400 });
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const admin = createAdminSupabaseClient();
  if (!paystackSecret || !admin) return NextResponse.json({ paid: false, error: "Payment verification is not configured" }, { status: 503 });

  const isKeyOrder = reference.startsWith("KEY-");
  const table = isKeyOrder ? "uniplug_key_orders" : "uniplug_member_orders";
  const amountColumn = isKeyOrder ? "amount_kes" : "total_kes";
  const { data: order } = await admin.from(table).select(`id,${amountColumn},payment_status`).eq("paystack_reference", reference).maybeSingle();
  if (!order) return NextResponse.json({ paid: false, error: "Order not found" }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ paid: true, state: "paid", reference });

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${paystackSecret}` }, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  const expectedKes = Number("amount_kes" in order ? order.amount_kes : order.total_kes);
  const providerStatus = String(result?.data?.status || "").toLowerCase();
  const amountMatches = Number(result?.data?.amount) === Math.round(expectedKes * 100);
  const paid = response.ok && providerStatus === "success" && amountMatches;
  if (!paid) {
    if (providerStatus === "success" && !amountMatches) {
      await admin.from(table).update({ payment_status: "amount_mismatch", fulfillment_status: "manual_review" }).eq("id", order.id);
      return NextResponse.json({ paid: false, state: "failed", reference, error: "The paid amount needs manual review. Contact support with this reference." }, { status: 409 });
    }
    if (["pending", "processing", "ongoing", "queued"].includes(providerStatus) || (response.ok && !providerStatus)) {
      return NextResponse.json({ paid: false, state: "pending", reference, error: "Payment is still pending confirmation. Do not pay again yet." }, { status: 202 });
    }
    return NextResponse.json({ paid: false, state: "failed", reference, error: "Payment was not completed or could not be confirmed." }, { status: 400 });
  }

  await admin.from(table).update({ payment_status: "paid", fulfillment_status: isKeyOrder ? "pending_delivery" : "pending_activation", paid_at: new Date().toISOString() }).eq("id", order.id);
  return NextResponse.json({ paid: true, state: "paid", reference });
}
