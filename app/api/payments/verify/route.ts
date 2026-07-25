import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference")?.trim() || "";
  if (!/^UP-[A-Z0-9-]{12,80}$/.test(reference)) return NextResponse.json({ paid: false, error: "Invalid payment reference" }, { status: 400 });
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const admin = createAdminSupabaseClient();
  if (!paystackSecret || !admin) return NextResponse.json({ paid: false, error: "Payment verification is not configured" }, { status: 503 });

  const { data: order } = await admin.from("uniplug_member_orders").select("id,total_kes,payment_status").eq("paystack_reference", reference).maybeSingle();
  if (!order) return NextResponse.json({ paid: false, error: "Order not found" }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ paid: true });

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${paystackSecret}` }, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  const paid = response.ok && result?.data?.status === "success" && Number(result.data.amount) === Math.round(Number(order.total_kes) * 100);
  if (!paid) return NextResponse.json({ paid: false, error: "Payment has not been confirmed" }, { status: 400 });

  await admin.from("uniplug_member_orders").update({ payment_status: "paid", fulfillment_status: "pending_activation", paid_at: new Date().toISOString() }).eq("id", order.id);
  return NextResponse.json({ paid: true });
}
