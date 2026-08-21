import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const products = read("lib/storefront-products.ts");
const home = read("components/storefront-home.tsx");
const header = read("components/key-store.tsx");
const productPage = read("app/products/[slug]/page.tsx");
const productDetail = read("components/physical-product-detail.tsx");
const cart = read("components/store-cart.tsx");
const checkout = read("app/api/store/checkout/route.ts");
const migration = read("supabase/migrations/20260820150000_physical_store_orders.sql");
const verify = read("app/api/payments/verify/route.ts");
const webhook = read("app/api/payments/webhook/route.ts");
const proxy = read("lib/supabase/proxy.ts");

const checks = [
  [page.includes("getStorefrontProducts") && page.includes("<StorefrontHome"), "Public store home must load the unified catalog server-side"],
  [products.includes('.from("uniplug_products")') && products.includes('.from("catalog")'), "Storefront must read both shared ChezaHub physical catalog sources"],
  [products.includes("PHYSICAL_PRODUCT_TYPES") && products.includes(".range(offset, offset + 999)"), "Physical catalog reads must filter physical types and paginate beyond the Supabase row limit"],
  [products.includes("existingSlugs") && products.includes("additionalAccessories"), "Overlapping shared catalog rows must be deduplicated by slug"],
  [products.includes('href: `/products/${row.slug}`') && !products.includes("chezahub.co.ke/gadgets"), "Physical products must stay on internal UniPlug product pages"],
  [products.includes("KEY_PRODUCTS") && products.includes('fulfillment: "digital"') && products.includes('fulfillment: "physical"'), "Unified catalog must distinguish digital and physical fulfillment"],
  [home.includes("Show more products") && home.includes("StoreAddButton") && home.includes("PAGE_SIZE"), "Large catalogs must use incremental rendering with quick-add controls"],
  [header.includes("StoreCartIndicator") && header.includes("Free Nairobi delivery over KSh 10,000"), "Store header must expose the live physical cart and delivery offer"],
  [productPage.includes("getPhysicalProductBySlug") && productDetail.includes("StoreProductPurchase"), "Every physical item must have a local detail and purchase route"],
  [cart.includes('fetch("/api/store/checkout"') && cart.includes("Delivery details") && cart.includes("calculateStoreDeliveryFee"), "Physical cart must collect delivery details and use the store checkout"],
  [checkout.includes('.from("uniplug_products")') && checkout.includes('.from("catalog")') && !checkout.includes("priceKes: item"), "Checkout must recalculate product prices from the shared catalog"],
  [checkout.includes("subtotalKes") && checkout.includes("deliveryFeeKes") && checkout.includes("totalKes * 100"), "Paystack amount must use the server-calculated physical order total"],
  [migration.includes("uniplug_store_orders") && migration.includes("uniplug_store_order_items") && migration.includes("revoke all") && migration.includes("service_role"), "Physical orders must use private server-only tables"],
  [verify.includes("UP|KEY|ST") && webhook.includes("getPaymentOrderConfig"), "Payment verification and webhooks must recognize physical ST references"],
  [proxy.includes('pathname.startsWith("/products/")') && proxy.includes('pathname === "/cart"') && proxy.includes('pathname === "/api/store/checkout"'), "Store routing must allow product, cart and checkout paths"]
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  failed.forEach(([, message]) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(`Verified ${checks.length} full physical-store catalog, cart, order, and payment invariants.`);
