import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260813235751_verify_tool_phase_three_operations.sql");
const operations = read("lib/verify-operations.ts");
const gmail = read("lib/gmail.ts");
const actions = read("app/admin/mailboxes/actions.ts");
const page = read("app/admin/mailboxes/page.tsx");
const core = read("lib/verify.ts");
const support = read("app/dashboard/support/page.tsx");
const memberTool = read("components/verify-tool.tsx");

assert.match(migration, /client_subscriptions[\s\S]*verify_enabled boolean not null default true/i);
assert.match(migration, /uniplug_verify_admin_events/);
assert.match(migration, /uniplug_verify_alerts/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.uniplug_verify_admin_events from public, anon, authenticated/i);
assert.match(migration, /revoke all on public\.uniplug_verify_alerts from public, anon, authenticated/i);
assert.match(migration, /Never stores mailbox secrets, messages, or verification codes/i);

assert.match(gmail, /getMailboxLock\("INBOX", \{ readOnly: true \}\)/);
assert.doesNotMatch(gmail.match(/export async function testMailboxConnection[\s\S]*?\n\}/)?.[0] || "", /fetchOne|search\(/);
assert.match(actions, /testMailboxConnection/);
assert.match(actions, /existingCredentialPreserved: true/);
assert.match(actions, /mailbox_credentials_revoked/);
assert.match(actions, /\^\[a-z0-9\]\{16\}\$/i);
assert.match(page, /Subscription-tracked mailbox/);
assert.match(page, /accountByEmail/);
assert.match(page, /Boolean\(account\.id\)/);
assert.match(actions, /subscription_disabled/);
assert.match(actions, /alert_resolved/);
assert.doesNotMatch(actions, /encrypted_app_password[^\n]*metadata/);

assert.match(operations, /repeated_no_code/);
assert.match(operations, /unusual_member_activity/);
assert.match(operations, /provider_format_change/);
assert.match(operations, /authentication_failure/);
assert.doesNotMatch(operations, /message_fingerprint|encrypted_app_password|verification_code/);

assert.match(page, /Success · 24h/);
assert.match(page, /Safe test/);
assert.match(page, /Test & securely save/);
assert.match(page, /VeriFy assignments/);
assert.match(page, /Operational alerts/);
assert.match(page, /Administrator audit/);
assert.match(page, /const clientMap = new Map/);
assert.doesNotMatch(page, /clients!client_subscriptions_client_id_fkey/);

assert.match(core, /subscription\.verify_enabled/);
assert.match(core, /verifySupportUrl/);
assert.match(support, /Never send passwords, OTPs, verification codes, or payment credentials/);
assert.match(memberTool, /Create a prefilled support ticket/);

console.log("Verified 34 VeriFy Phase 3 operations, credential, alert, audit, subscription-control, and support invariants.");
