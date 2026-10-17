import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function moduleUrl(path, replacements = []) {
  let source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}

const domainsUrl = moduleUrl("lib/domains.ts");
const domains = await import(domainsUrl);
const { authCookieOptionsForHostname } = await import(moduleUrl("lib/auth-cookie.ts", [["@/lib/domains", domainsUrl]]));
const { isKeysHostname } = await import(moduleUrl("lib/site-mode.ts", [
  ['import "server-only";', ""],
  ['import { headers } from "next/headers";', ""],
  ["@/lib/domains", domainsUrl]
]));

for (const root of ["uniplug.co.ke", "uniplug.shop"]) {
  for (const hostname of [root, `www.${root}`, `vip.${root}`, `VIP.${root.toUpperCase()}:443`, `${root}.`]) {
    assert.equal(domains.uniPlugCookieDomain(hostname), `.${root}`);
    assert.deepEqual(authCookieOptionsForHostname(hostname), {
      path: "/", sameSite: "lax", secure: true, domain: `.${root}`
    });
  }
  assert.equal(isKeysHostname(root), true);
  assert.equal(isKeysHostname(`www.${root}`), true);
  assert.equal(isKeysHostname(`vip.${root}`), false);
}
for (const hostname of ["localhost:3000", "vip.localhost:3000", "eviluniplug.co.ke", "uniplug.co.ke.evil.test", "uniplug.shop.evil.test", "preview.vercel.app", ""]) {
  assert.equal(domains.uniPlugCookieDomain(hostname), undefined);
  assert.equal(Object.hasOwn(authCookieOptionsForHostname(hostname), "domain"), false);
}
assert.equal(isKeysHostname("vip.localhost:3000"), false);
assert.equal(isKeysHostname("VIP.UNIPLUG.CO.KE:443"), false);
assert.equal(domains.STORE_ORIGIN, process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.co.ke");
assert.equal(domains.VIP_SITE_ORIGIN, process.env.NEXT_PUBLIC_VIP_SITE_URL || "https://vip.uniplug.co.ke");
const login = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
const provisioning = readFileSync(new URL("../lib/portal-provisioning.ts", import.meta.url), "utf8");
assert.ok(login.includes("@members.uniplug.shop"));
assert.ok(provisioning.includes("@members.uniplug.shop"));
console.log("Verified old/new storefront and VIP routing, cookie isolation, and stable member identities.");
