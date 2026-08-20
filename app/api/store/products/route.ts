import { NextResponse } from "next/server";
import { getStorefrontProducts, type StorefrontCategory } from "@/lib/storefront-products";

const categories = new Set<StorefrontCategory>([
  "software", "games", "gaming", "audio", "power", "peripherals", "storage", "accessories"
]);

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const requestedCategory = parameters.get("category") as StorefrontCategory | null;
  const category = requestedCategory && categories.has(requestedCategory) ? requestedCategory : null;
  const query = (parameters.get("q") || "").trim().toLowerCase().slice(0, 100);
  const offset = Math.max(0, Math.min(10000, Number(parameters.get("offset")) || 0));
  const limit = Math.max(1, Math.min(48, Number(parameters.get("limit")) || 24));
  const products = await getStorefrontProducts();
  const filtered = products.filter((product) => {
    if (category && product.category !== category) return false;
    if (!query) return true;
    return `${product.name} ${product.brand} ${product.categoryLabel} ${product.platform || ""} ${product.fulfillment}`.toLowerCase().includes(query);
  });
  return NextResponse.json(
    { products: filtered.slice(offset, offset + limit), total: filtered.length },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
  );
}
