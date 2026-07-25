import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile || viewer.profile.status !== "active") return NextResponse.json({ error: "Member sign-in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const phone = String(body.phone || "").replace(/[^+\d]/g, "").slice(0, 20);
  const planIds = [...new Set(Array.isArray(body.planIds) ? body.planIds.map(String) : [])].filter((id) => uuidPattern.test(id)).slice(0, 20);
  if (phone.replace(/\D/g, "").length < 9 || !planIds.length) return NextResponse.json({ error: "A valid phone number and at least one plan are required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const { data, error } = await supabase.rpc("uniplug_create_member_order", { p_plan_ids: planIds, p_phone: phone });
  const order = Array.isArray(data) ? data[0] : data;
  if (error || !order) return NextResponse.json({ error: error?.message || "Order could not be created" }, { status: 400 });

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) return NextResponse.json({ error: "Payment provider is not configured" }, { status: 503 });

  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop"}/payment-return`;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: order.customer_email, amount: Math.round(Number(order.total_kes) * 100), currency: "KES", reference: order.paystack_reference, callback_url: callbackUrl, metadata: { order_id: order.order_id, order_number: order.order_number, user_id: viewer.user.id } }),
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.data?.authorization_url) {
    const admin = createAdminSupabaseClient();
    await admin?.from("uniplug_member_orders").update({ payment_status: "initialization_failed" }).eq("id", order.order_id);
    return NextResponse.json({ error: "Payment provider could not start checkout" }, { status: 502 });
  }

  return NextResponse.json({ authorizationUrl: result.data.authorization_url, orderNumber: order.order_number });
}
