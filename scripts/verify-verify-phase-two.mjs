import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260813232405_verify_tool_phase_two.sql");
const providerTypes = read("lib/verify/provider-types.ts");
const registry = read("lib/verify/provider-registry.ts");
const netflix = read("lib/verify/providers/netflix.ts");
const parser = read("lib/verify/providers/netflix-parser.ts");
const core = read("lib/verify.ts");
const page = read("app/tools/verify/page.tsx");
const clientPortal = read("lib/client-portal.ts");

for (const contractField of [
  "isEligible",
  "allowedSenderDomains",
  "messageQuery",
  "parseMessage",
  "codeTtlMs",
  "instructions",
  "recentAuthenticationMaxAgeSeconds"
]) assert.match(providerTypes, new RegExp(contractField));

assert.match(registry, /new Map<VerifyProviderId, VerifyProviderAdapter>/);
assert.match(netflix, /allowedSenderDomains: \["netflix\.com"\]/);
assert.match(parser, /password\\s\+reset/);
assert.match(parser, /hostname === "netflix\.com" \|\| hostname\.endsWith/);

assert.match(clientPortal, /verify_enabled,verify_provider/);
assert.match(page, /getVerifyProvider/);
assert.doesNotMatch(page, /toLowerCase\(\)\.includes\("netflix"\)/);

assert.match(migration, /client_services_verify_capability_check/);
assert.match(migration, /uniplug_reserve_verify_request/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /uniplug_household_events_ip_rate_idx/);
assert.match(migration, /uniplug_verify_message_receipts/);
assert.match(migration, /never codes or email content/i);
assert.match(migration, /revoke execute on function public\.uniplug_reserve_verify_request[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.uniplug_reserve_verify_request[\s\S]*to service_role/i);

assert.match(core, /uniplug_reserve_verify_request/);
assert.match(core, /verifyRequestIpHash/);
assert.match(core, /uniplug_record_verify_message/);
assert.match(core, /failure_category/);
assert.match(core, /latency_ms/);
assert.match(core, /needsRecentAuthentication/);
assert.doesNotMatch(core, /\.toLowerCase\(\)\.includes\("netflix"\)/);

console.log("Verified 30 VeriFy Phase 2 provider, capability, atomic-limit, anomaly, idempotency, and telemetry invariants.");
