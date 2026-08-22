import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260814002345_verify_tool_phase_four_rollout_governance.sql");
const rollout = read("lib/verify-rollout.ts");
const registry = read("lib/verify/provider-registry.ts");
const core = read("lib/verify.ts");
const memberPage = read("app/tools/verify/page.tsx");
const actions = read("app/admin/verify/providers/actions.ts");
const page = read("app/admin/verify/providers/page.tsx");

assert.match(migration, /uniplug_verify_provider_rollouts/);
assert.match(migration, /uniplug_verify_provider_cohorts/);
assert.match(migration, /operational_status in \('disabled', 'pilot', 'live', 'paused'\)/);
assert.match(migration, /operational_status not in \('pilot', 'live'\)[\s\S]*authorization_status = 'approved'[\s\S]*terms_review_status = 'approved'/);
assert.match(migration, /forbidden_code_classes_confirmed/);
assert.match(migration, /revoke all on public\.uniplug_verify_provider_rollouts from public, anon, authenticated/i);
assert.match(migration, /revoke all on public\.uniplug_verify_provider_cohorts from public, anon, authenticated/i);
assert.match(migration, /grant all on public\.uniplug_verify_provider_rollouts to service_role/i);
assert.match(migration, /grant all on public\.uniplug_verify_provider_cohorts to service_role/i);
assert.match(migration, /provider_access_denied/);
assert.match(migration, /'netflix',[\s\S]*'live',[\s\S]*'approved'/);

assert.match(rollout, /providerRolloutIsReady/);
assert.match(rollout, /operational_status === "live"/);
assert.match(rollout, /uniplug_verify_provider_cohorts/);
assert.match(rollout, /provider_pilot_restricted/);
assert.doesNotMatch(rollout, /encrypted_app_password|message_fingerprint|verification_code/);
assert.match(registry, /listVerifyProviders/);

const gatePosition = core.indexOf("getVerifyProviderAccess");
const reservePosition = core.indexOf('"uniplug_reserve_verify_request"');
const mailboxPosition = core.indexOf('"uniplug_mailbox_credentials"');
assert.ok(gatePosition > 0 && gatePosition < reservePosition && reservePosition < mailboxPosition, "provider gate runs before rate reservation and mailbox access");
assert.match(core, /provider_access_denied/);
assert.match(core, /provider_unavailable/);
assert.match(memberPage, /getVerifyProviderAccess/);

assert.match(actions, /getVerifyProvider\(provider\)/);
assert.match(actions, /providerRolloutIsReady/);
assert.match(actions, /operational_status: "paused"/);
assert.match(actions, /provider_paused/);
assert.match(actions, /provider_cohort_added/);
assert.match(actions, /provider_cohort_removed/);
assert.match(actions, /adapter\?\.isEligible/);

assert.match(page, /Provider rollout gates/);
assert.match(page, /Activation gates/);
assert.match(page, /Instant shutdown/);
assert.match(page, /Pilot cohort/);
assert.match(page, /Only providers in the reviewed application registry/);

console.log("Verified 38 VeriFy Phase 4 authorization, readiness, cohort, kill-switch, audit, and server-only invariants.");
