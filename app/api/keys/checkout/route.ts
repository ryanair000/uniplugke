import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getKeyProduct } from "@/lib/key-products";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { isKeysHostname } from "@/lib/site-mode";

export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (!isKeysHostname(host)) return NextResponse.json({ error: "Not available on the member portal" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { product?: unknown; email?: unknown; phone?: unknown };
  const product = getKeyProduct(body.product);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const phone = String(body.phone || "").replace(/[^+\d]/g, "").slice(0, 20);
  if (!product || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "Choose a valid product and enter a valid email and phone number" }, { status: 400 });
  }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const admin = createAdminSupabaseClient();
  if (!secret || !admin) return NextResponse.json({ error: "Checkout is not configured" }, { status: 503 });

  const reference = `KEY-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`;
  const { data: order, error } = await admin.from("uniplug_key_orders").insert({
    paystack_reference: reference, product_slug: product.slug, product_name: product.name,
    licence_term: product.term, amount_kes: product.priceKes, customer_email: email, customer_phone: phone
  }).select("id").single();
  if (error || !order) return NextResponse.json({ error: "Order could not be created" }, { status: 500 });

  const origin = new URL(request.url).origin;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: product.priceKes * 100, currency: "KES", reference, callback_url: `${origin}/payment-return`, metadata: { order_type: "software_key", key_order_id: order.id, product: product.slug } }), cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.data?.authorization_url) {
    await admin.from("uniplug_key_orders").update({ payment_status: "initialization_failed" }).eq("id", order.id);
    return NextResponse.json({ error: "Payment provider could not start checkout" }, { status: 502 });
  }
  return NextResponse.json({ authorizationUrl: result.data.authorization_url }, { headers: { "Cache-Control": "no-store" } });
}

