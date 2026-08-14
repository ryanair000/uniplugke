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
    name: "the priced Lokimax catalog drives the UniPlug catalog",
    source: read("lib/catalog.ts") + read("lib/lokimax-services.ts"),
    tokens: [
      '.from("catalog")',
      '.eq("category", "entertainment")',
      'selling_price_1_month',
      "buildLokimaxCatalog",
      "canonicalLokimaxCatalogKey",
      "CUSTOMER_HIDDEN_SERVICE_SLUGS",
      '"dstv-compact"',
      '"dstv-premium"',
      "customerVisibleCatalog(buildLokimaxCatalog"
    ]
  },
  {
    name: "catalog pages support both visitors and members",
    source: read("app/page.tsx") + read("app/services/page.tsx") + read("app/services/[slug]/page.tsx"),
    tokens: ["await getViewer()", "isMember"]
  },
  {
    name: "catalog cards split guest USD and signed-in KSh prices",
    source: read("components/catalog-explorer.tsx") + read("components/service-card.tsx"),
    tokens: [
      "service.startingPriceUsd != null",
      "formatUsd(service.startingPriceUsd)",
      "usdToKes(service.startingPriceUsd!)",
      "CatalogSoftwareCard",
      "isMember={isMember}",
      "isMember ? formatDualPrice(product.priceKes) : formatUsd(kesToUsd(product.priceKes))"
    ]
  },
  {
    name: "signed-in service details use KSh even without a private plan",
    source: read("app/services/[slug]/page.tsx"),
    tokens: [
      "isMember && (primaryPlan || service.startingPriceUsd)",
      "usdToKes(service.startingPriceUsd!)",
      "formatUsd(service.startingPriceUsd)"
    ]
  },
  {
    name: "Lokimax prices become public USD prices without duplicate aliases",
    source: read("lib/lokimax-services.ts"),
    tokens: ["kesToUsd(monthlyPriceKes)", "seen.has(serviceSlug)", 'prime: "primevideo"']
  },
  {
    name: "every visible priced Lokimax service receives a purchasable member plan",
    source: read("supabase/migrations/20260814021112_make_all_priced_services_purchasable.sql"),
    tokens: [
      "catalog.selling_price_1_month > 0",
      "row_number() over",
      "source.slug || '-member'",
      "source.monthly_price_kes",
      "uniplug_plan_duration_offers",
      "(1, 0::numeric",
      "(3, 3::numeric",
      "(6, 8::numeric",
      "(12, 13::numeric",
      "(24, 17::numeric"
    ]
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

console.log(`Verified ${checks.length} public-USD, member-KSh, and Lokimax catalog source invariants.`);

