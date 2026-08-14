import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { isKeysHostname } from "@/lib/site-mode";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  const salt = process.env.KEY_REQUEST_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "uniplug-key-request";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function POST(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (!isKeysHostname(host)) return NextResponse.json({ error: "Not available on the member portal" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (String(body.website || "").trim()) return NextResponse.json({ ok: true });

  const softwareName = String(body.softwareName || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const platform = String(body.platform || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const phone = String(body.phone || "").replace(/[^+\d]/g, "").slice(0, 20);
  const notes = String(body.notes || "").trim().slice(0, 1000) || null;
  if (softwareName.length < 2 || platform.length < 2 || !emailPattern.test(email) || phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "Enter a software name, platform, valid email, and valid phone number" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: "Key requests are not configured" }, { status: 503 });

  const ipHash = requestIpHash(request);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [emailCount, ipCount] = await Promise.all([
    admin.from("uniplug_key_requests").select("id", { count: "exact", head: true }).eq("customer_email", email).gte("created_at", since),
    admin.from("uniplug_key_requests").select("id", { count: "exact", head: true }).eq("request_ip_hash", ipHash).gte("created_at", since)
  ]);
  if (emailCount.error || ipCount.error) return NextResponse.json({ error: "Key requests are temporarily unavailable" }, { status: 503 });
  if ((emailCount.count || 0) >= 3 || (ipCount.count || 0) >= 10) {
    return NextResponse.json({ error: "Too many recent requests. Try again later or email support@uniplug.shop." }, { status: 429 });
  }

  const reference = `REQ-${Date.now().toString(36).toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
  const { error } = await admin.from("uniplug_key_requests").insert({
    request_reference: reference,
    software_name: softwareName,
    platform,
    customer_email: email,
    customer_phone: phone,
    notes,
    request_ip_hash: ipHash
  });
  if (error) return NextResponse.json({ error: "Your request could not be saved" }, { status: 500 });

  return NextResponse.json(
    { ok: true, reference, status: "new" },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
