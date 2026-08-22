import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260822013500_member_access_short_links.sql");
const adminRoute = read("app/api/admin/member-access/route.ts");
const shortRoute = read("app/access/[code]/route.ts");
const adminUi = read("components/admin-member-access.tsx");

assert.match(migration, /uniplug_member_access_links/);
assert.match(migration, /max_uses smallint not null default 3/);
assert.match(migration, /use_count < link\.max_uses/);
assert.match(migration, /expires_at > now\(\)/);
assert.match(migration, /grant execute on function public\.uniplug_consume_member_access_link\(text\) to service_role/);
assert.match(adminRoute, /ACCESS_TTL_HOURS = 48/);
assert.match(adminRoute, /ACCESS_MAX_USES = 3/);
assert.match(adminRoute, /new URL\(`\/access\/\$\{code\}`/);
assert.match(adminRoute, /revoked_at/);
assert.doesNotMatch(adminRoute, /token_hash/);
assert.match(shortRoute, /uniplug_consume_member_access_link/);
assert.match(shortRoute, /admin\.auth\.admin\.generateLink/);
assert.match(shortRoute, /verifyOtp/);
assert.match(shortRoute, /Cache-Control/);
assert.match(shortRoute, /Referrer-Policy/);
assert.match(adminUi, /Valid for 48 hours/);
assert.match(adminUi, /Copy short link/);

console.log("Verified friendly 48-hour, 3-use UniPlug member access links.");
