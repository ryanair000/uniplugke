import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { calculateStoreDeliveryFee } from "@/lib/store-shipping";
import { PHYSICAL_PRODUCT_TYPES, storefrontCategoryLabel, type StorefrontCategory } from "@/lib/storefront-products";
import { isKeysHostname } from "@/lib/site-mode";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type CheckoutBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  county?: unknown;
  city?: unknown;
  address?: unknown;
  deliveryNotes?: unknown;
  items?: unknown;
};

type ValidatedLine = {
  source: "uniplug_products" | "catalog";
  sourceId: string;
  slug: string;
  name: string;
  categoryLabel: string;
  image: string | null;
  priceKes: number;
  stockQuantity: number | null;
  quantity: number;
};

function clean(value: unknown, limit: number) {
  return String(value || "").trim().slice(0, limit);
}

function categoryLabel(category: string, subcategory: string | null) {
  if (subcategory) return subcategory.replaceAll("-", " ");
  const mapped: StorefrontCategory = category === "disk-games" ? "games"
    : ["earbuds", "headphones", "speakers"].includes(category) ? "audio"
      : ["power-banks", "chargers-cables"].includes(category) ? "power"
        : category === "peripherals" ? "peripherals"
          : category === "gaming" ? "gaming"
            : "accessories";
  return storefrontCategoryLabel(mapped);
}

export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (!isKeysHostname(host)) return NextResponse.json({ error: "Not available on the member portal" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as CheckoutBody;
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 20).replace(/[^+\d]/g, "");
  const county = clean(body.county, 100);
  const city = clean(body.city, 100);
  const address = clean(body.address, 300);
  const deliveryNotes = clean(body.deliveryNotes, 500);

  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "Enter a valid name, email and phone number" }, { status: 400 });
  }
  if (county.length < 2 || city.length < 2 || address.length < 5) {
    return NextResponse.json({ error: "Enter a complete Kenyan delivery address" }, { status: 400 });
  }

  const requested = Array.isArray(body.items) ? body.items.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as { slug?: unknown; quantity?: unknown };
    const slug = clean(item.slug, 180);
    const quantity = Math.floor(Number(item.quantity));
    return /^[a-z0-9-]{2,180}$/.test(slug) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10
      ? [{ slug, quantity }]
      : [];
  }) : [];
  const merged = Array.from(requested.reduce((items, item) => {
    items.set(item.slug, Math.min(10, (items.get(item.slug) || 0) + item.quantity));
    return items;
  }, new Map<string, number>())).map(([slug, quantity]) => ({ slug, quantity })).slice(0, 20);
  if (!merged.length) return NextResponse.json({ error: "Add at least one valid physical product" }, { status: 400 });

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const admin = createAdminSupabaseClient();
  if (!paystackSecret || !admin) return NextResponse.json({ error: "Physical checkout is not configured" }, { status: 503 });

  const slugs = merged.map((item) => item.slug);
  const [physicalResult, accessoryResult] = await Promise.all([
    admin.from("uniplug_products")
      .select("id,slug,name,category,subcategory,price_kes,cover_image,stock_quantity")
      .in("slug", slugs)
      .in("type", [...PHYSICAL_PRODUCT_TYPES])
      .eq("in_stock", true)
      .gt("price_kes", 0),
    admin.from("catalog")
      .select("id,slug,name,platform,genre,selling_price,image_url,stock_quantity,unlimited_stock")
      .in("slug", slugs)
      .eq("category", "accessories")
      .gt("selling_price", 0)
      .is("deleted_at", null)
  ]);
  if (physicalResult.error || accessoryResult.error) {
    return NextResponse.json({ error: "The catalog could not be checked. Please try again." }, { status: 503 });
  }

  const bySlug = new Map<string, Omit<ValidatedLine, "quantity">>();
  for (const row of physicalResult.data || []) {
    bySlug.set(row.slug, {
      source: "uniplug_products",
      sourceId: row.id,
      slug: row.slug,
      name: row.name,
      categoryLabel: categoryLabel(row.category, row.subcategory),
      image: row.cover_image,
      priceKes: Number(row.price_kes),
      stockQuantity: row.stock_quantity
    });
  }
  for (const row of accessoryResult.data || []) {
    if (bySlug.has(row.slug)) continue;
    bySlug.set(row.slug, {
      source: "catalog",
      sourceId: row.id,
      slug: row.slug,
      name: row.name,
      categoryLabel: row.genre || "Accessories",
      image: row.image_url,
      priceKes: Number(row.selling_price),
      stockQuantity: row.unlimited_stock ? null : row.stock_quantity
    });
  }

  const lines: ValidatedLine[] = [];
  for (const item of merged) {
    const product = bySlug.get(item.slug);
    if (!product) return NextResponse.json({ error: "One or more products are no longer available" }, { status: 409 });
    if (product.stockQuantity !== null && item.quantity > product.stockQuantity) {
      return NextResponse.json({ error: `${product.name} only has ${product.stockQuantity} available` }, { status: 409 });
    }
    lines.push({ ...product, quantity: item.quantity });
  }

  const subtotalKes = lines.reduce((total, line) => total + line.priceKes * line.quantity, 0);
  const deliveryFeeKes = calculateStoreDeliveryFee(subtotalKes, county, city);
  const totalKes = subtotalKes + deliveryFeeKes;
  const reference = `ST-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`;
  const orderNumber = `UNI-S-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;

  const { data: order, error: orderError } = await admin.from("uniplug_store_orders").insert({
    order_number: orderNumber,
    paystack_reference: reference,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    delivery_county: county,
    delivery_city: city,
    delivery_address: address,
    delivery_notes: deliveryNotes || null,
    subtotal_kes: subtotalKes,
    delivery_fee_kes: deliveryFeeKes,
    total_kes: totalKes
  }).select("id").single();
  if (orderError || !order) return NextResponse.json({ error: "The physical order could not be created" }, { status: 500 });

  const { error: itemError } = await admin.from("uniplug_store_order_items").insert(lines.map((line) => ({
    order_id: order.id,
    product_source: line.source,
    product_source_id: line.sourceId,
    product_slug: line.slug,
    product_name: line.name,
    category_label: line.categoryLabel,
    image_url: line.image,
    unit_price_kes: line.priceKes,
    quantity: line.quantity,
    line_total_kes: line.priceKes * line.quantity
  })));
  if (itemError) {
    await admin.from("uniplug_store_orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "The physical order items could not be saved" }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: Math.round(totalKes * 100),
      currency: "KES",
      reference,
      callback_url: `${origin}/payment-return`,
      metadata: {
        order_type: "physical_store",
        store_order_id: order.id,
        order_number: orderNumber,
        customer_phone: phone,
        delivery_city: city,
        item_count: lines.reduce((total, line) => total + line.quantity, 0)
      }
    }),
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.data?.authorization_url) {
    await admin.from("uniplug_store_orders").update({ payment_status: "initialization_failed", updated_at: new Date().toISOString() }).eq("id", order.id);
    return NextResponse.json({ error: "Payment provider could not start checkout" }, { status: 502 });
  }

  return NextResponse.json(
    { authorizationUrl: result.data.authorization_url, orderNumber, reference },
    { headers: { "Cache-Control": "no-store" } }
  );
}
