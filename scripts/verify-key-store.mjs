import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const products = read("lib/key-products.ts");
const checkout = read("app/api/keys/checkout/route.ts");
const checkoutUi = read("components/key-store.tsx");
const keySupport = read("components/key-support.tsx");
const keyRequestRoute = read("app/api/keys/requests/route.ts");
const orderStatusRoute = read("app/api/keys/order-status/route.ts");
const paymentVerify = read("app/api/payments/verify/route.ts");
const detailPage = read("app/keys/[slug]/page.tsx");
const productDetail = read("components/key-product-detail.tsx");
const proxy = read("lib/supabase/proxy.ts");
const migration = read("supabase/migrations/20260813170000_public_software_key_orders.sql");
const authCookie = read("lib/auth-cookie.ts");
const accountRouting = read("lib/account-routing.ts");
const login = read("app/api/auth/login/route.ts");
const registration = read("app/api/auth/register/route.ts");
const vipMembershipMigration = read("supabase/migrations/20260813234628_restrict_vip_membership_to_lokimax_services.sql");
const supportMigration = read("supabase/migrations/20260813234650_public_software_key_requests.sql");

const checks = [
  [products.includes('priceKes: 1000') && products.includes('term: "month"'), "Adobe price/term must remain KSh 1,000 per month"],
  [products.includes('priceKes: 2500') && products.includes('term: "year"'), "Windows price/term must remain KSh 2,500 per year"],
  [checkout.includes("product.priceKes * 100"), "Paystack amount must come from the server product catalog"],
  [!checkout.includes("body.price") && !checkout.includes("body.amount"), "Public checkout must never accept a browser-supplied price"],
  [proxy.includes('pathname === "/api/keys/checkout"'), "Key checkout must be explicitly scoped in hostname routing"],
  [migration.includes("enable row level security") && migration.includes("revoke all on table public.uniplug_key_orders from public, anon, authenticated"), "Key orders must remain inaccessible to public Data API roles"],
  [authCookie.includes('domain: ".uniplug.shop"') && authCookie.includes("isUniPlugDomain"), "Auth cookies must be shared only across UniPlug subdomains"],
  [accountRouting.includes('.from("client_portal_accounts")') && accountRouting.includes('.from("client_subscriptions")'), "VIP access must require a Lokimax portal link and tracked service"],
  [login.includes("vipAccess.hasService || isAdmin") && login.includes("storeAccountDestination"), "Login must split VIP and regular-shop destinations"],
  [registration.includes("supabase.auth.signUp") && registration.includes('.from("uniplug_profiles").insert'), "Regular users must be able to create a shop account"],
  [proxy.includes('pathname === "/register"') && proxy.includes('pathname === "/api/auth/register"'), "The public shop must expose registration routes"],
  [proxy.includes('pathname.startsWith("/keys/")'), "Shareable software-key detail routes must remain public on the store hostname"],
  [detailPage.includes("generateStaticParams") && productDetail.includes("Check these licence details"), "Each software key must have a shareable, truth-safe detail page"],
  [products.includes("pendingTerms") && products.includes("keyProductEndOfTermDisclosure"), "Unconfirmed material terms must be explicit in the shared product model"],
  [!products.includes("one supported device") && !products.includes("including professional productivity"), "Unconfirmed device and feature claims must not return"],
  [checkoutUi.includes("termsAcknowledged") && checkout.includes("body.termsAcknowledged !== true"), "Material licence terms must be acknowledged in both the UI and server checkout"],
  [checkout.includes("terms_version") && checkout.includes("material_terms_acknowledged"), "Paystack metadata must carry the acknowledged licence terminology"],
  [keySupport.includes('fetch("/api/keys/requests"') && keyRequestRoute.includes("request_reference: reference"), "Unavailable-key requests must be saved through the server instead of relying on mailto"],
  [keyRequestRoute.includes("request_ip_hash") && keyRequestRoute.includes(">= 10") && keyRequestRoute.includes(">= 3"), "Public key requests must use hashed-IP and email rate limits"],
  [supportMigration.includes("enable row level security") && supportMigration.includes("revoke all on table public.uniplug_key_requests from public, anon, authenticated"), "Public key requests must remain private behind server-only access"],
  [orderStatusRoute.includes('.eq("paystack_reference", reference)') && orderStatusRoute.includes('.eq("customer_email", email)'), "Public order lookup must require both the reference and matching order email"],
  [paymentVerify.includes('state: "pending"') && paymentVerify.includes('state: "failed"') && paymentVerify.includes('state: "paid"'), "Payment verification must distinguish paid, pending, and failed outcomes"],
  [supportMigration.includes("material_terms_acknowledged_at") && checkout.includes("material_terms_acknowledged_at"), "The exact material-term acknowledgement must be preserved with the order"],
  [vipMembershipMigration.includes("client_portal_accounts") && vipMembershipMigration.includes("client_subscriptions") && vipMembershipMigration.includes("profile.role = 'admin'") && vipMembershipMigration.includes("security invoker"), "Database VIP membership must require a Lokimax service or administrator without privileged execution"]
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  failed.forEach(([, message]) => console.error(`FAIL: ${message}`));
  process.exit(1);
}
console.log(`Verified ${checks.length} software-key pricing, host boundary, and order-security invariants.`);
