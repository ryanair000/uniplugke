import { findLatestCodeWithAppPassword } from "@/lib/gmail";
import type { VerifyProviderAdapter } from "@/lib/verify/provider-types";
import { parseChatGptMessage } from "@/lib/verify/providers/chatgpt-parser";

const codeTtlMs = 10 * 60_000;
const eligibleStatuses = new Set(["active", "due_soon", "trial"]);

export const chatGptVerifyProvider: VerifyProviderAdapter = {
  id: "chatgpt",
  displayName: "ChatGPT",
  mark: "AI",
  messageQuery: "from:(openai.com) newer_than:2d",
  allowedSenderDomains: ["openai.com"],
  codeTtlMs,
  recentAuthenticationMaxAgeSeconds: null,
  instructions: [
    { title: "Request the code", detail: "On ChatGPT request a verification code by email." },
    { title: "Return to UniPlug", detail: "Keep this page open while the email arrives." },
    { title: "Use the newest code", detail: "UniPlug will show the latest valid six-digit code." }
  ],
  isEligible({ status, capabilityEnabled, hasAssignedAccount }) {
    return capabilityEnabled && hasAssignedAccount && eligibleStatuses.has(status);
  },
  parseMessage(text) {
    return parseChatGptMessage(text);
  },
  retrieveLatestCode({ mailboxEmail, encryptedAppPassword }) {
    return findLatestCodeWithAppPassword({
      mailboxEmail,
      encryptedAppPassword,
      provider: "chatgpt",
      messageQuery: this.messageQuery,
      allowedSenderDomains: this.allowedSenderDomains,
      codeTtlMs: this.codeTtlMs,
      parseMessage: this.parseMessage
    });
  }
};
