import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260804191344_client_portal_invites_and_replacements.sql");
const invites = read("app/api/admin/invitations/route.ts");
const login = read("app/api/auth/login/route.ts");
const subscriptions = read("app/dashboard/subscriptions/page.tsx");
const detail = read("app/dashboard/subscriptions/[id]/page.tsx");
const access = read("app/api/portal/subscriptions/[id]/access/route.ts");
const replace = read("app/api/portal/subscriptions/[id]/replace/route.ts");

assert.match(migration, /revoke all on public\.accounts from anon/i);
assert.match(migration, /Portal users read own subscriptions/);
assert.match(migration, /must_change_password = false/);
assert.match(migration, /uniplug_replace_client_account/);
assert.match(migration, /interval '15 minutes'/);
assert.match(migration, />= 3/);
assert.match(invites, /temporaryPhonePassword/);
assert.match(invites, /client_portal_accounts/);
assert.match(invites, /whatsappUrl/);
assert.match(login, /normalizeKenyanPhone/);
assert.doesNotMatch(subscriptions, /current_period_start/);
assert.doesNotMatch(detail, /provider_reference/);
assert.match(access, /Cache-Control.*no-store/s);
assert.match(replace, /uniplug_replace_client_account/);

console.log("Verified 14 client portal, credential-boundary, and instant-replacement invariants.");
