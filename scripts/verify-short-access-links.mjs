import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260822123000_member_access_short_codes_compat.sql");
const adminRoute = read("app/api/admin/member-access/route.ts");
const shortRoute = read("app/access/[code]/route.ts");
const adminUi = read("components/admin-member-access.tsx");
const proxy = read("lib/supabase/proxy.ts");

assert.match(migration, /add column if not exists code text/);
assert.match(migration, /uniplug_consume_member_access_link\(p_code text\)/);
assert.match(migration, /use_count < link\.max_uses/);
assert.doesNotMatch(migration, /expires_at > now\(\)/);
assert.match(adminRoute, /ACCESS_LINK_MAX_USES = 3/);
assert.match(adminRoute, /9999-12-31T23:59:59\.999Z/);
assert.match(adminRoute, /new URL\(`\/access\/\$\{code\}`/);
assert.match(adminRoute, /portalLink/);
assert.match(adminRoute, /no time expiry/);
assert.doesNotMatch(adminRoute, /48 hours|ACCESS_TTL_HOURS/);
assert.match(shortRoute, /uniplug_consume_member_access_link/);
assert.match(shortRoute, /update\(\{ expires_at: ACCESS_LINK_NO_TIME_EXPIRY \}\)/);
assert.match(shortRoute, /destination/);
assert.match(shortRoute, /getClientFamilyIds/);
assert.match(proxy, /pathname\.startsWith\("\/access\/"\)/);
assert.match(proxy, /!isMemberAccessPath\(pathname\)/);
assert.match(adminUi, /Copy services message/);
assert.match(adminUi, /No time expiry/);

console.log("Verified 18 non-expiring, three-use short VIP access-link invariants.");
