import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const checks = [
  {
    name: "the request proxy leaves catalog routes public and gates member routes",
    source: read("lib/supabase/proxy.ts"),
    tokens: [
      'const publicPaths = new Set([',
      'function isPublicCatalogPath(',
      '.from("uniplug_profiles")',
      'profile?.status !== "active"',
      'loginUrl.pathname = "/login"',
      '"Cache-Control", "private, no-store, max-age=0"'
    ]
  },
  {
    name: "the database exposes active catalog rows but keeps plans private",
    source: read("supabase/migrations/20260812160556_public_usd_catalog_access.sql") + read("supabase/migrations/20260730163130_invite_only_storefront.sql"),
    tokens: [
      'create policy "guest reads active uniplug catalog"',
      'create policy "active members read uniplug catalog"',
      "grant select on public.uniplug_catalog_services to anon"
    ]
  },
  {
    name: "member prices display in Kenyan shillings",
    source: read("lib/currency.ts"),
    tokens: ["formatUsd", "formatKes", "return formatKes(valueKes)"]
  },
  {
    name: "member catalog and checkout use the shared KSh formatter",
    source: read("components/catalog.tsx") + read("components/checkout.tsx"),
    tokens: ["formatDualPrice(plan.priceKes)", "formatDualPrice(displayedTotal)", "final KSh amount"]
  },
  {
    name: "Lokimax exact catalog offers drive the UniPlug catalog",
    source: read("lib/catalog.ts") + read("supabase/migrations/20260902020000_sync_lokimax_catalog_exact_prices.sql"),
    tokens: ['.from("uniplug_public_catalog_offers")', "uniplug_sync_catalog_product", "o.price_kes", "live-stream-sports"]
  },
  {
    name: "catalog pages support both visitors and members",
    source: read("app/page.tsx") + read("app/services/page.tsx") + read("app/services/[slug]/page.tsx"),
    tokens: ["await getViewer()", "isMember"]
  },
  {
    name: "every guest catalog card exposes exact KSh prices and available terms",
    source: read("components/catalog-explorer.tsx") + read("components/service-card.tsx"),
    tokens: ["service.publicPlans", "startingOffer.priceKes", "planDurationLabel(startingOffer.durationMonths)", "formatDualPrice(product.priceKes)"]
  }
];

const failed = checks.filter((check) =>
  check.tokens.some((token) => !check.source.includes(token))
);

if (failed.length) {
  for (const check of failed) {
    console.error(`Invite-only dual-pricing check failed: ${check.name}`);
  }
  process.exit(1);
}

const customerFacingSource = [
  "app/page.tsx",
  "app/about/page.tsx",
  "app/help/page.tsx",
  "app/login/page.tsx",
  "app/services/page.tsx",
  "app/services/[slug]/page.tsx",
  "components/catalog.tsx",
  "components/checkout.tsx",
  "components/renewal-checkout.tsx",
  "components/service-card.tsx"
].map(read).join("\n");

if (/approximate USD equivalent/i.test(customerFacingSource)) {
  console.error("Split-currency pricing check failed: legacy dual-price copy remains customer-facing");
  process.exit(1);
}

const publicCardSource = read("components/catalog-explorer.tsx") + read("components/service-card.tsx");
if (/Member catalog|services with local support and member-managed access|Contact for price|Create a support ticket/i.test(publicCardSource)) {
  console.error("Public catalog card check failed: removed guest-facing catalog copy was reintroduced");
  process.exit(1);
}

console.log(`Verified ${checks.length} exact-price, member-KSh, and Lokimax catalog source invariants.`);
