import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { isKeysHostname } from "@/lib/site-mode";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (!isKeysHostname(host)) return NextResponse.json({ error: "Not available on the member portal" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const reference = String(body.reference || "").trim().toUpperCase();
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!/^KEY-[A-Z0-9-]{12,80}$/.test(reference) || !emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid key-order reference and order email" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Order lookup is not configured" }, { status: 503 });
  const { data, error } = await admin
    .from("uniplug_key_orders")
    .select("paystack_reference,product_name,licence_term,amount_kes,payment_status,fulfillment_status,created_at,paid_at,fulfilled_at")
    .eq("paystack_reference", reference)
    .eq("customer_email", email)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Order lookup is temporarily unavailable" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "No matching order was found" }, { status: 404 });

  return NextResponse.json({
    reference: data.paystack_reference,
    productName: data.product_name,
    licenceTerm: data.licence_term,
    amountKes: Number(data.amount_kes),
    paymentStatus: data.payment_status,
    fulfillmentStatus: data.fulfillment_status,
    createdAt: data.created_at,
    paidAt: data.paid_at,
    fulfilledAt: data.fulfilled_at
  }, { headers: { "Cache-Control": "private, no-store" } });
}
