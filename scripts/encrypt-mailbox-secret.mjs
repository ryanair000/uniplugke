import { createCipheriv, createHash, randomBytes } from "node:crypto";

const keyMaterial = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
const secret = process.env.MAILBOX_APP_PASSWORD;
if (!keyMaterial || !secret) throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY and MAILBOX_APP_PASSWORD are required.");

const key = createHash("sha256").update(keyMaterial).digest();
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
process.stdout.write(`v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`);
