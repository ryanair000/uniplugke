import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { decodedMimeText } from "../lib/verify/mime.ts";
import { confirmNetflixHouseholdLink, parseNetflixHouseholdMessage, parseNetflixMessage } from "../lib/verify/providers/netflix-parser.ts";

const fixtureUrl = (name) => new URL(`../tests/fixtures/verify/${name}`, import.meta.url);
const parseFixture = async (name, resolveLink) => {
  const source = await readFile(fileURLToPath(fixtureUrl(name)));
  return parseNetflixMessage(decodedMimeText(source), resolveLink);
};

assert.equal(await parseFixture("netflix-plain.eml"), "4821");
assert.equal(await parseFixture("netflix-html.eml"), "5730");
assert.equal(await parseFixture("netflix-quoted-printable.eml"), "6804");
assert.equal(await parseFixture("netflix-sign-in-html.eml"), "1946");
assert.equal(await parseFixture("netflix-sign-in-plain.eml"), "3058");

let resolvedLink = "";
assert.equal(
  await parseFixture("netflix-link.eml", async (link) => {
    resolvedLink = link;
    return "9137";
  }),
  "9137"
);
assert.match(resolvedLink, /^https:\/\/www\.netflix\.com\//);

assert.equal(await parseFixture("netflix-password-reset.eml"), null);
assert.equal(await parseFixture("unrelated-otp.eml"), null);

const householdSource = await readFile(fileURLToPath(fixtureUrl("netflix-household-update.eml")));
const householdLink = parseNetflixHouseholdMessage(decodedMimeText(householdSource));
assert.match(householdLink || "", /^https:\/\/www\.netflix\.com\/account\/update-primary-location/);
const decoySource = await readFile(fileURLToPath(fixtureUrl("netflix-household-decoy.eml")));
assert.equal(parseNetflixHouseholdMessage(decodedMimeText(decoySource)), null);
assert.equal(parseNetflixHouseholdMessage('<p>Netflix Household</p><a href="https://evil.example/confirm">Yes, This Was Me</a>'), null);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response("", { status: 302, headers: { location: "https://evil.example/steal" } });
  assert.equal(await confirmNetflixHouseholdLink("https://www.netflix.com/account/update-primary-location?token=safe"), false);
  globalThis.fetch = async () => new Response("Netflix Household updated successfully", { status: 200 });
  assert.equal(await confirmNetflixHouseholdLink("https://www.netflix.com/account/update-primary-location?token=safe"), true);
  assert.equal(await confirmNetflixHouseholdLink("https://evil.example/confirm"), false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Verified 14 sanitized VeriFy code, Household, redirect-boundary, reset, and unrelated-OTP parser cases.");
