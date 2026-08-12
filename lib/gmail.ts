import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { ImapFlow } from "imapflow";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

type OAuthState = { accountId: string; userId: string; exp: number };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; internalDate?: string; payload?: GmailPart };

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

function decodedMimeText(source: Buffer) {
  const raw = source.toString("utf8");
  const quotedPrintable = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
  const decodedBlocks = [...raw.matchAll(/(?:^|\r?\n)([A-Za-z0-9+/]{40,}(?:\r?\n[A-Za-z0-9+/]{20,})*={0,2})(?=\r?\n|$)/gm)]
    .map((match) => {
      try { return Buffer.from(match[1].replace(/\s/g, ""), "base64").toString("utf8"); } catch { return ""; }
    });
  return [raw, quotedPrintable, ...decodedBlocks].join("\n");
}

export async function findLatestNetflixCodeWithAppPassword(mailboxEmail: string, encryptedAppPassword: string) {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: mailboxEmail, pass: decryptMailboxSecret(encryptedAppPassword).replace(/\s/g, "") },
    logger: false,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const matches = await client.search({ gmraw: "from:(netflix.com) newer_than:2d" }, { uid: true });
      for (const uid of (matches || []).slice(-8).reverse()) {
        const message = await client.fetchOne(uid, { source: { maxLength: 2_000_000 }, internalDate: true }, { uid: true });
        if (!message || !message.source) continue;
        const receivedAt = message.internalDate ? new Date(message.internalDate) : new Date();
        const expiresAt = new Date(receivedAt.getTime() + 15 * 60_000);
        if (expiresAt.getTime() <= Date.now()) continue;
        const text = decodedMimeText(message.source);
        let code = codeNearLabel(text);
        if (!code) {
          for (const link of netflixLinks(text).slice(0, 4)) {
            code = await codeFromNetflixLink(link);
            if (code) break;
          }
        }
        if (code) return { code, expiresAt: expiresAt.toISOString(), receivedAt: receivedAt.toISOString() };
      }
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

async function refreshGmailAccessToken(refreshToken: string) {
  const result = await googleToken(new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET || "",
    grant_type: "refresh_token"
  }));
  return result.access_token;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function messageText(part?: GmailPart): string {
  if (!part) return "";
  const own = part.body?.data ? decodeBase64Url(part.body.data) : "";
  return [own, ...(part.parts || []).map(messageText)].join("\n");
}

function htmlDecode(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#x3D;", "=").replaceAll("=3D", "=").replaceAll("&quot;", '"');
}

function codeNearLabel(text: string) {
  const normalized = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return normalized.match(/(?:temporary|access|verification)\s+code\D{0,80}(\d{4})/i)?.[1]
    || normalized.match(/(?:your\s+code|code\s+is)\D{0,40}(\d{4})/i)?.[1]
    || null;
}

function netflixLinks(text: string) {
  const decoded = htmlDecode(text);
  const matches = decoded.match(/https:\/\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map((link) => link.replace(/[)>.,]+$/, "")))].filter((link) => {
    try { return new URL(link).hostname.toLowerCase().endsWith("netflix.com"); } catch { return false; }
  });
}

function safeNetflixUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (hostname === "netflix.com" || hostname.endsWith(".netflix.com")) ? url : null;
  } catch {
    return null;
  }
}

async function codeFromNetflixLink(link: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let current = safeNetflixUrl(link);
    for (let redirect = 0; current && redirect <= 3; redirect += 1) {
      const response = await fetch(current, { redirect: "manual", cache: "no-store", signal: controller.signal, headers: { "User-Agent": "UniPlug temporary-code assistant" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        current = location ? safeNetflixUrl(location, current.toString()) : null;
        continue;
      }
      if (!response.ok) return null;
      return codeNearLabel(await response.text());
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function findLatestNetflixCode(encryptedRefreshToken: string) {
  const accessToken = await refreshGmailAccessToken(decryptRefreshToken(encryptedRefreshToken));
  const headers = { Authorization: `Bearer ${accessToken}` };
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", "from:(netflix.com) newer_than:2d");
  listUrl.searchParams.set("maxResults", "8");
  const listResponse = await fetch(listUrl, { headers, cache: "no-store" });
  const list = await listResponse.json().catch(() => ({})) as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!listResponse.ok) throw new Error(list.error?.message || "Netflix email could not be checked.");

  for (const item of list.messages || []) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`, { headers, cache: "no-store" });
    if (!response.ok) continue;
    const message = await response.json() as GmailMessage;
    const receivedAt = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
    const expiresAt = new Date(receivedAt.getTime() + 15 * 60_000);
    if (expiresAt.getTime() <= Date.now()) continue;
    const text = messageText(message.payload);
    let code = codeNearLabel(text);
    if (!code) {
      for (const link of netflixLinks(text).slice(0, 4)) {
        code = await codeFromNetflixLink(link);
        if (code) break;
      }
    }
    if (code) return { code, expiresAt: expiresAt.toISOString(), receivedAt: receivedAt.toISOString() };
  }
  return null;
}
