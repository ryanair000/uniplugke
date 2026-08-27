import { findLatestCodeWithAppPassword, findLatestMailboxMessageWithAppPassword } from "@/lib/gmail";
import type { VerifyProviderAdapter } from "@/lib/verify/provider-types";
import { confirmNetflixHouseholdLink, parseNetflixHouseholdMessage, parseNetflixMessage } from "@/lib/verify/providers/netflix-parser";

const codeTtlMs = 15 * 60_000;
const eligibleStatuses = new Set(["active", "due_soon", "trial"]);

export const netflixVerifyProvider: VerifyProviderAdapter = {
  id: "netflix",
  displayName: "Netflix",
  mark: "N",
  messageQuery: "from:(netflix.com) newer_than:2d",
  allowedSenderDomains: ["netflix.com"],
  codeTtlMs,
  recentAuthenticationMaxAgeSeconds: null,
  instructions: [
    { title: "Request the email", detail: "On Netflix choose Send Email." },
    { title: "Return to VeriFy", detail: "It can take a few seconds for the message to arrive." },
    { title: "Get your code", detail: "Codes normally expire about 15 minutes after receipt." }
  ],
  isEligible({ status, capabilityEnabled, hasAssignedAccount }) {
    return capabilityEnabled && hasAssignedAccount && eligibleStatuses.has(status);
  },
  parseMessage(text) {
    return parseNetflixMessage(text);
  },
  retrieveLatestCode({ mailboxEmail, encryptedAppPassword }) {
    return findLatestCodeWithAppPassword({
      mailboxEmail,
      encryptedAppPassword,
      provider: "netflix",
      messageQuery: this.messageQuery,
      allowedSenderDomains: this.allowedSenderDomains,
      codeTtlMs: this.codeTtlMs,
      parseMessage: this.parseMessage
    });
  },
  async approveLatestHouseholdUpdate({ mailboxEmail, encryptedAppPassword }) {
    const result = await findLatestMailboxMessageWithAppPassword({
      mailboxEmail,
      encryptedAppPassword,
      provider: "netflix-household",
      messageQuery: "from:(netflix.com) newer_than:2d",
      allowedSenderDomains: this.allowedSenderDomains,
      codeTtlMs,
      parseMessage: parseNetflixHouseholdMessage
    });
    if (!result || !await confirmNetflixHouseholdLink(result.value)) return null;
    return {
      expiresAt: result.expiresAt,
      receivedAt: result.receivedAt,
      messageFingerprint: result.messageFingerprint
    };
  }
};
