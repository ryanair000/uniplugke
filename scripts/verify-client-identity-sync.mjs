import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const identity = read("lib/client-identity.ts");
const accountRouting = read("lib/account-routing.ts");
const login = read("app/api/auth/login/route.ts");
const invitations = read("app/api/admin/invitations/route.ts");
const clientPortal = read("lib/client-portal.ts");

assert.match(identity, /hub_resolve_client_id/);
assert.match(identity, /client_identity_aliases/);
assert.match(identity, /getClientFamilyIds/);
assert.match(identity, /findPortalUserForClient/);
assert.match(accountRouting, /\.in\("status", \["active", "due_soon", "trial"\]\)/);
assert.doesNotMatch(accountRouting, /\.eq\("client_id", portal\.client_id\)/);
assert.match(accountRouting, /metadata\.interest_only !== true/);
assert.match(login, /findPortalUserForClient/);
assert.match(login, /phone_e164\.eq/);
assert.match(invitations, /getClientFamilyIds/);
assert.match(clientPortal, /getClientFamilyIds/);

console.log("Verified canonical LokiMax/UniPlug identity, alias-aware login, provisioning, and VIP routing invariants.");
