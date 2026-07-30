import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const checks = [
  {
    name: "the request proxy gates the whole storefront by active membership",
    source: read("lib/supabase/proxy.ts"),
    tokens: [
      'const publicPaths = new Set([',
      '.from("uniplug_profiles")',
      'profile?.status !== "active"',
      'loginUrl.pathname = "/login"',
      '"Cache-Control", "private, no-store, max-age=0"'
    ]
  },
  {
    name: "the database catalog is unavailable to anonymous clients",
    source: read("supabase/migrations/20260730163130_invite_only_storefront.sql"),
    tokens: [
      'drop policy if exists "guest reads active uniplug catalog"',
      'create policy "active members read uniplug catalog"',
      "revoke all on public.uniplug_catalog_services from anon"
    ]
  },
  {
    name: "member prices display KSh and an approximate USD equivalent",
    source: read("lib/currency.ts"),
    tokens: ["NEXT_PUBLIC_KES_PER_USD", "formatKes", "kesToUsd", "formatUsd", "formatDualPrice"]
  },
  {
    name: "catalog and checkout use the shared dual-currency formatter",
    source: read("components/catalog.tsx") + read("components/checkout.tsx"),
    tokens: ["formatDualPrice(plan.priceKes)", "formatDualPrice(displayedTotal)", "charged in KSh"]
  },
  {
    name: "private pages enforce membership independently of navigation",
    source: read("app/page.tsx") + read("app/services/page.tsx") + read("app/services/[slug]/page.tsx"),
    tokens: ["await requireMember()", "isMember"]
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

console.log(`Verified ${checks.length} invite-only and dual-currency source invariants.`);
