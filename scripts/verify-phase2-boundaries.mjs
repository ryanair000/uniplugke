import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const checks = [
  {
    name: "guest cart is disabled by the authenticated viewer",
    source: read("app/layout.tsx"),
    tokens: ["const isMember", "<CartProvider enabled={isMember}"]
  },
  {
    name: "sign-out removes saved member cart data",
    source: read("components/auth.tsx"),
    tokens: ["localStorage.removeItem(\"uniplug-member-cart\")", "supabase.auth.signOut()"]
  },
  {
    name: "member portal routes require active membership",
    source: read("app/dashboard/layout.tsx"),
    tokens: ["requireMember()", "Member portal"]
  },
  {
    name: "member settings are rejected at the request boundary",
    source: read("lib/supabase/proxy.ts"),
    tokens: ['"/settings"', "isProtected && !data.user", 'loginUrl.pathname = "/login"']
  },
  {
    name: "renewal checkout authenticates and reprices through the database",
    source: read("app/api/renewals/route.ts"),
    tokens: ["viewer.profile.status !== \"active\"", "uniplug_create_renewal_order", "Math.round(Number(order.total_kes) * 100)"]
  },
  {
    name: "renewals extend the existing subscription",
    source: read("supabase/migrations/20260725205000_phase2_renewal_orders.sql"),
    tokens: ["renewal_subscription_id", "greatest(coalesce(s.current_period_end, now()), now())", "uniplug_create_renewal_order"]
  },
  {
    name: "subscription requests are protected by ownership RLS",
    source: read("supabase/migrations/20260725203000_phase2_member_operations.sql"),
    tokens: ["members read own subscription requests", "user_id = (select auth.uid())", "uniplug_request_subscription_action"]
  },
  {
    name: "paid-order activation retries are no-ops",
    source: read("supabase/migrations/20260725210000_phase2_hardening.sql"),
    tokens: ["for update", "fulfillment_status in ('active', 'completed')", "then return 0"]
  },
  {
    name: "privileged member RPCs are removed from the anonymous API surface",
    source: read("supabase/migrations/20260725210000_phase2_hardening.sql"),
    tokens: [
      "uniplug_update_member_profile(text,text,text,boolean,boolean) from public, anon",
      "uniplug_set_member_status(uuid,text) from public, anon",
      "uniplug_record_password_update() from public, anon"
    ]
  },
  {
    name: "all remaining member and trigger RPCs have explicit API grants",
    source: read("supabase/migrations/20260725214549_phase2_rpc_surface_hardening.sql"),
    tokens: [
      "is_uniplug_member() from public, anon, authenticated",
      "uniplug_create_member_order(uuid[], text) from public, anon, authenticated",
      "uniplug_create_renewal_order(uuid, text) from public, anon, authenticated",
      "uniplug_log_subscription_event() from public, anon, authenticated"
    ]
  },
  {
    name: "profile writes are routed through the validated RPC",
    source: read("supabase/migrations/20260725210000_phase2_hardening.sql"),
    tokens: ["revoke update on public.uniplug_profiles from authenticated"]
  }
];

const failed = checks.filter((check) => check.tokens.some((token) => !check.source.includes(token)));
if (failed.length) {
  for (const check of failed) console.error(`Phase 2 boundary check failed: ${check.name}`);
  process.exit(1);
}
console.log(`Verified ${checks.length} Phase 2 source invariants. Database behavior is covered by the pgTAP suite.`);
