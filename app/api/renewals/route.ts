import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RenewalRequestBody = {
  subscriptionId?: unknown;
  phone?: unknown;
};

type PaystackInitializeResponse = {
  data?: { authorization_url?: string };
};

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile || viewer.profile.status !== "active") {
    return NextResponse.json({ error: "Member sign-in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as RenewalRequestBody;
  const subscriptionId = String(body.subscriptionId || "");
  const phone = String(body.phone || "").replace(/[^+\d]/g, "").slice(0, 20);
  if (!uuidPattern.test(subscriptionId) || phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "A valid subscription and phone number are required" }, { status: 400 });
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) return NextResponse.json({ error: "Payment provider is not configured" }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const { data, error } = await supabase.rpc("uniplug_create_renewal_order", {
    p_subscription_id: subscriptionId,
    p_phone: phone
  });
  const order = Array.isArray(data) ? data[0] : data;
  if (error || !order) return NextResponse.json({ error: error?.message || "Renewal order could not be created" }, { status: 400 });

  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop"}/payment-return`;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: order.customer_email,
      amount: Math.round(Number(order.total_kes) * 100),
      currency: "KES",
      reference: order.paystack_reference,
      callback_url: callbackUrl,
      metadata: {
        order_id: order.order_id,
        order_number: order.order_number,
        user_id: viewer.user.id,
        renewal_subscription_id: subscriptionId
      }
    }),
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({})) as PaystackInitializeResponse;
  if (!response.ok || !result.data?.authorization_url) {
    const admin = createAdminSupabaseClient();
    await admin?.from("uniplug_member_orders").update({ payment_status: "initialization_failed" }).eq("id", order.order_id);
    return NextResponse.json({ error: "Payment provider could not start the renewal" }, { status: 502 });
  }

  return NextResponse.json({ authorizationUrl: result.data.authorization_url, orderNumber: order.order_number });
}
