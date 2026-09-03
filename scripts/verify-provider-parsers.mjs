import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { decodedMimeText } from "../lib/verify/mime.ts";
import { newestMailboxMessagesFirst } from "../lib/verify/mailbox-order.ts";
import { verificationMailboxPath } from "../lib/verify/mailbox-selection.ts";
import { parseChatGptMessage } from "../lib/verify/providers/chatgpt-parser.ts";
import { parseNetflixMessage } from "../lib/verify/providers/netflix-parser.ts";

const fixtureUrl = (name) => new URL(`../tests/fixtures/verify/${name}`, import.meta.url);
const parseNetflixFixture = async (name, resolveLink) => {
  const source = await readFile(fileURLToPath(fixtureUrl(name)));
  return parseNetflixMessage(await decodedMimeText(source), resolveLink);
};
const parseChatGptFixture = async (name) => {
  const source = await readFile(fileURLToPath(fixtureUrl(name)));
  return parseChatGptMessage(await decodedMimeText(source));
};

assert.equal(await parseNetflixFixture("netflix-plain.eml"), "4821");
assert.equal(await parseNetflixFixture("netflix-html.eml"), "5730");
assert.equal(await parseNetflixFixture("netflix-quoted-printable.eml"), "6804");
assert.equal(await parseNetflixFixture("netflix-sign-in-html.eml"), "1946");
assert.equal(await parseNetflixFixture("netflix-sign-in-plain.eml"), "3058");
assert.equal(await parseNetflixFixture("netflix-sign-in-long-html.eml"), "6417");
assert.equal(await parseNetflixFixture("netflix-sign-in-realistic.eml"), "8969");
assert.equal(await parseNetflixFixture("netflix-sign-in-missing-code.eml"), null);

let resolvedLink = "";
assert.equal(
  await parseNetflixFixture("netflix-link.eml", async (link) => {
    resolvedLink = link;
    return "9137";
  }),
  "9137"
);
assert.match(resolvedLink, /^https:\/\/www\.netflix\.com\//);

assert.equal(await parseNetflixFixture("netflix-password-reset.eml"), null);
assert.equal(await parseNetflixFixture("unrelated-otp.eml"), null);
assert.equal(await parseChatGptFixture("chatgpt-verification.eml"), "483921");
assert.equal(await parseChatGptFixture("chatgpt-password-reset.eml"), null);
assert.equal(await parseChatGptMessage("Your verification code is 111222"), null);

const mailboxMessages = newestMailboxMessagesFirst([
  { uid: 903, receivedAt: new Date("2026-08-24T17:37:00.000Z"), value: "older-high-uid" },
  { uid: 901, receivedAt: new Date("2026-08-24T17:40:00.000Z"), value: "newest-by-date" },
  { uid: 902, receivedAt: new Date("2026-08-24T17:38:00.000Z"), value: "middle" }
]);
assert.deepEqual(mailboxMessages.map(({ value }) => value), ["newest-by-date", "middle", "older-high-uid"]);
assert.equal(verificationMailboxPath([{ path: "INBOX", specialUse: "\\Inbox" }, { path: "[Gmail]/All Mail", specialUse: "\\All" }]), "[Gmail]/All Mail");
assert.equal(verificationMailboxPath([{ path: "INBOX", specialUse: "\\Inbox" }]), "INBOX");

console.log("Verified Netflix and ChatGPT sanitized VeriFy MIME/parser fixtures plus mailbox ordering and mailbox selection.");
