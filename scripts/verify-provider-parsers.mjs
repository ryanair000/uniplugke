import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { decodedMimeText } from "../lib/verify/mime.ts";
import { parseNetflixMessage } from "../lib/verify/providers/netflix-parser.ts";

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

console.log("Verified 8 sanitized VeriFy MIME, HTML, sign-in, quoted-printable, link, reset, and unrelated-OTP fixtures.");
