import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { ImapFlow } from "imapflow";
import { decodedMimeText } from "@/lib/verify/mime";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

type OAuthState = { accountId: string; userId: string; exp: number };

type MailboxCodeOptions = {
  mailboxEmail: string;
  encryptedAppPassword: string;
  provider: string;
  messageQuery: string;
  allowedSenderDomains: readonly string[];
  codeTtlMs: number;
  parseMessage(text: string): Promise<string | null>;
};

export type MailboxConnectionFailureCategory =
  | "mailbox_authentication_failed"
  | "mailbox_provider_error";

function gmailImapClient(mailboxEmail: string, encryptedAppPassword: string) {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: mailboxEmail, pass: decryptMailboxSecret(encryptedAppPassword).replace(/\s/g, "") },
    logger: false,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000
  });
}

export function classifyMailboxConnectionError(error: unknown): MailboxConnectionFailureCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return /(auth|credential|password|login|invalid credentials)/.test(message)
    ? "mailbox_authentication_failed"
    : "mailbox_provider_error";
}

export async function testMailboxConnection({
  mailboxEmail,
  encryptedAppPassword
}: {
  mailboxEmail: string;
  encryptedAppPassword: string;
}) {
  const startedAt = Date.now();
  const client = gmailImapClient(mailboxEmail, encryptedAppPassword);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    lock.release();
    return { latencyMs: Math.max(0, Date.now() - startedAt) };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

function secretMaterial() {
  return process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function encryptionKey() {
  const material = secretMaterial();
  if (!material) throw new Error("Mailbox token encryption is not configured.");
  return createHash("sha256").update(material).digest();
}

export function hasGmailOAuthConfig() {
  return Boolean(process.env.GOOGLE_GMAIL_CLIENT_ID && process.env.GOOGLE_GMAIL_CLIENT_SECRET && secretMaterial());
}

export function gmailRedirectUri(origin: string) {
  return process.env.GOOGLE_GMAIL_REDIRECT_URI || `${origin}/api/admin/gmail/callback`;
}

export function encryptRefreshToken(value: string) {
  return encryptMailboxSecret(value);
}

export function encryptMailboxSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptRefreshToken(value: string) {
  return decryptMailboxSecret(value);
}

export function decryptMailboxSecret(value: string) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Mailbox connection is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

function senderIsAllowed(
  senders: Array<{ address?: string | null }> | undefined,
  allowedSenderDomains: readonly string[]
) {
  return Boolean(senders?.some(({ address }) => {
    const domain = address?.split("@").pop()?.toLowerCase();
    return domain && allowedSenderDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
  }));
}

export async function findLatestCodeWithAppPassword({
  mailboxEmail,
  encryptedAppPassword,
  provider,
  messageQuery,
  allowedSenderDomains,
  codeTtlMs,
  parseMessage
}: MailboxCodeOptions) {
  const client = gmailImapClient(mailboxEmail, encryptedAppPassword);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const matches = await client.search({ gmraw: messageQuery }, { uid: true });
      const scan = {
        provider,
        queryMatchCount: Array.isArray(matches) ? matches.length : 0,
        inspectedMessageCount: 0,
        missingSourceCount: 0,
        disallowedSenderCount: 0,
        expiredMessageCount: 0,
        parserRejectedCount: 0
      };
      for (const uid of (matches || []).slice(-8).reverse()) {
        scan.inspectedMessageCount += 1;
        const message = await client.fetchOne(
          uid,
          { source: { maxLength: 2_000_000 }, internalDate: true, envelope: true },
          { uid: true }
        );
        if (!message || !message.source) {
          scan.missingSourceCount += 1;
          continue;
        }
        if (!senderIsAllowed(message.envelope?.from, allowedSenderDomains)) {
          scan.disallowedSenderCount += 1;
          continue;
        }
        const receivedAt = message.internalDate ? new Date(message.internalDate) : new Date();
        const expiresAt = new Date(receivedAt.getTime() + codeTtlMs);
        if (expiresAt.getTime() <= Date.now()) {
          scan.expiredMessageCount += 1;
          continue;
        }
        const code = await parseMessage(decodedMimeText(message.source));
        if (code) {
          console.info("VeriFy mailbox scan completed", { ...scan, outcome: "code_found" });
          const messageFingerprint = createHash("sha256")
            .update(`${provider}:${mailboxEmail.toLowerCase()}:${String(uid)}:${receivedAt.toISOString()}`)
            .digest("hex");
          return {
            code,
            messageFingerprint,
            expiresAt: expiresAt.toISOString(),
            receivedAt: receivedAt.toISOString()
          };
        }
        scan.parserRejectedCount += 1;
      }
      console.info("VeriFy mailbox scan completed", { ...scan, outcome: "code_not_found" });
      return null;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export function createGmailOAuthState(accountId: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({ accountId, userId, exp: Date.now() + 10 * 60_000 } satisfies OAuthState)).toString("base64url");
  const signature = createHmac("sha256", encryptionKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyGmailOAuthState(value: string): OAuthState | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", encryptionKey()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  return parsed.exp > Date.now() ? parsed : null;
}

export function gmailAuthorizationUrl({ accountId, email, origin, userId }: { accountId: string; email: string; origin: string; userId: string }) {
  if (!hasGmailOAuthConfig()) throw new Error("Google Gmail OAuth is not configured.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_GMAIL_CLIENT_ID!);
  url.searchParams.set("redirect_uri", gmailRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", email);
  url.searchParams.set("state", createGmailOAuthState(accountId, userId));
  return url.toString();
}

async function googleToken(body: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error_description || "Google authorization failed.");
  return result as { access_token: string; refresh_token?: string };
}

export async function exchangeGmailAuthorizationCode(code: string, origin: string) {
  return googleToken(new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET || "",
    redirect_uri: gmailRedirectUri(origin),
    grant_type: "authorization_code"
  }));
}
