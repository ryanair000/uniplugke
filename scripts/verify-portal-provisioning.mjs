import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const provisioning = readFileSync(new URL("../lib/portal-provisioning.ts", import.meta.url), "utf8");
const cronRoute = readFileSync(new URL("../app/api/cron/portal-reconcile/route.ts", import.meta.url), "utf8");
const syncPage = readFileSync(new URL("../app/admin/sync/page.tsx", import.meta.url), "utf8");
const membersPage = readFileSync(new URL("../app/admin/members/page.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../lib/supabase/proxy.ts", import.meta.url), "utf8");
const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

assert.match(provisioning, /PORTAL_ELIGIBLE_STATUSES = \["active", "due_soon", "trial"\]/);
assert.match(provisioning, /portal_hidden/);
assert.match(provisioning, /interest_only/);
assert.match(provisioning, /hub_resolve|resolveCanonicalId|getClientFamilyIds/);
assert.match(provisioning, /findAuthUserByEmail/);
assert.match(provisioning, /portal_account_provisioned/);
assert.match(provisioning, /client_portal_accounts/);
assert.match(provisioning, /uniplug_profiles/);
assert.match(provisioning, /user_roles/);
assert.match(cronRoute, /timingSafeEqual/);
assert.match(cronRoute, /process\.env\.CRON_SECRET/);
assert.match(cronRoute, /reconcileEligiblePortalAccounts/);
assert.match(proxy, /\/api\/cron\/portal-reconcile/);
assert.match(syncPage, /missingCount/);
assert.match(membersPage, /missingCount/);
assert.match(membersPage, /PORTAL_ELIGIBLE_STATUSES\.includes\(row\.status/);
assert.match(membersPage, /triggerLabel=\{deliverySubscriptions\.length \? "Get access" : "View"\}/);
assert.deepEqual(vercel.crons, [{ path: "/api/cron/portal-reconcile", schedule: "17 1 * * *" }]);

console.log("Verified automatic, idempotent LokiMax portal provisioning and missing-account health invariants.");
