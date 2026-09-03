export type VerifyProviderId = "netflix" | "chatgpt";

export type VerifyInstruction = {
  title: string;
  detail: string;
};

export type VerifyEligibility = {
  status: string;
  capabilityEnabled: boolean;
  hasAssignedAccount: boolean;
};

export type VerifyMailboxRequest = {
  mailboxEmail: string;
  encryptedAppPassword: string;
};

export type VerifyProviderResult = {
  code: string;
  expiresAt: string;
  receivedAt: string;
  messageFingerprint: string;
};

export type VerifyProviderAdapter = {
  id: VerifyProviderId;
  displayName: string;
  mark: string;
  messageQuery: string;
  allowedSenderDomains: readonly string[];
  codeTtlMs: number;
  instructions: readonly VerifyInstruction[];
  recentAuthenticationMaxAgeSeconds: number | null;
  isEligible(input: VerifyEligibility): boolean;
  parseMessage(text: string): Promise<string | null>;
  retrieveLatestCode(input: VerifyMailboxRequest): Promise<VerifyProviderResult | null>;
};
