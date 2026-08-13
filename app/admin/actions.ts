"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { usdToKes } from "@/lib/currency";

const categories = new Set(["streaming", "music", "creative", "ai", "productivity", "cloud", "security", "gaming", "learning"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slug(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function lines(value: FormDataEntryValue | null) {
  return String(value || "").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

function refreshCatalog() {
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/admin");
  revalidatePath("/admin/catalog");
}

export async function createCatalogService(formData: FormData) {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const serviceSlug = slug(formData.get("slug") || name);
  const category = String(formData.get("category") || "productivity");
  const accentColor = String(formData.get("accentColor") || "#6957ff");
  if (!name || !serviceSlug) throw new Error("Name and slug are required");
  if (!categories.has(category)) throw new Error("Choose a valid category");
  if (!/^#[0-9a-f]{6}$/i.test(accentColor)) throw new Error("Choose a valid accent color");

  const { error } = await supabase.from("uniplug_catalog_services").insert({
    name,
    slug: serviceSlug,
    category_slug: category,
    short_description: String(formData.get("shortDescription") || "").trim().slice(0, 240),
    description: String(formData.get("description") || "").trim().slice(0, 4000),
    logo_text: String(formData.get("logoText") || "UP").trim().slice(0, 3),
    accent_color: accentColor,
    features: lines(formData.get("features")),
    supported_devices: lines(formData.get("supportedDevices")),
    setup_requirements: lines(formData.get("setupRequirements")),
    fulfillment_label: String(formData.get("fulfillmentLabel") || "Managed access").trim().slice(0, 100),
    activation_window: String(formData.get("activationWindow") || "Activation details available after sign-in").trim().slice(0, 300),
    replacement_summary: String(formData.get("replacementSummary") || "Eligible issues can be reported from the dashboard.").trim().slice(0, 500),
    availability_status: String(formData.get("availabilityStatus") || "available"),
    is_featured: formData.get("isFeatured") === "on",
    is_active: true
  });
  if (error) throw new Error(error.message);
  refreshCatalog();
  redirect("/admin/catalog?success=service");
}

export async function createMemberPlan(formData: FormData) {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const priceUsd = Number(formData.get("priceUsd"));
  const compareAtRaw = String(formData.get("compareAtUsd") || "").trim();
  const compareAtUsd = compareAtRaw ? Number(compareAtRaw) : null;
  const planName = String(formData.get("planName") || "").trim().slice(0, 100);
  const planCode = slug(formData.get("planCode") || planName);
  const serviceId = String(formData.get("serviceId") || "");
  if (!serviceId || !planName || !planCode) throw new Error("Service, plan name, and plan code are required");
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error("A valid price is required");
  if (compareAtUsd !== null && (!Number.isFinite(compareAtUsd) || compareAtUsd < priceUsd)) throw new Error("Compare-at price must be at least the member price");

  const { error } = await supabase.from("uniplug_member_plans").insert({
    service_id: serviceId,
    plan_name: planName,
    plan_code: planCode,
    price_kes: usdToKes(priceUsd),
    compare_at_kes: compareAtUsd === null ? null : usdToKes(compareAtUsd),
    billing_cycle: "monthly",
    plan_features: lines(formData.get("planFeatures")),
    purchase_limit: Math.min(20, Math.max(1, Number(formData.get("purchaseLimit") || 1))),
    availability_status: String(formData.get("availabilityStatus") || "available"),
    is_active: true
  });
  if (error) throw new Error(error.message);
  refreshCatalog();
  redirect("/admin/catalog?success=plan");
}

export async function activateMemberOrder(formData: FormData) {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const orderId = String(formData.get("orderId") || "");
  if (!uuidPattern.test(orderId)) throw new Error("A valid order is required");
  const { error } = await supabase.rpc("uniplug_activate_member_order", { p_order_id: orderId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  redirect("/admin/orders?success=activated");
}

export async function resolveSubscriptionRequest(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId") || "");
  const resolution = String(formData.get("resolution") || "");
  const adminNote = String(formData.get("adminNote") || "").trim().slice(0, 1000);
  if (!uuidPattern.test(requestId) || !["completed", "declined"].includes(resolution)) {
    throw new Error("A valid request and resolution are required");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.rpc("uniplug_resolve_subscription_request", {
    p_request_id: requestId,
    p_resolution: resolution,
    p_admin_note: adminNote || null
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard");
  redirect("/admin/requests?success=resolved");
}

export async function resolveReplacementApproval(formData: FormData) {
  const viewer = await requireAdmin();
  const requestId = String(formData.get("requestId") || "");
  const resolution = String(formData.get("resolution") || "");
  const adminNote = String(formData.get("adminNote") || "").trim().slice(0, 1000);
  if (!uuidPattern.test(requestId) || !["approved", "declined"].includes(resolution)) {
    throw new Error("A valid replacement request and decision are required");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("uniplug_replacement_approvals").update({
    status: resolution,
    admin_note: adminNote || null,
    reviewed_by: viewer.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", requestId).eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard/activity");
  redirect("/admin/requests?success=replacement_reviewed");
}

export async function updateSupportTicket(formData: FormData) {
  const viewer = await requireAdmin();
  const ticketId = String(formData.get("ticketId") || "");
  const status = String(formData.get("status") || "");
  const adminNote = String(formData.get("adminNote") || "").trim().slice(0, 2000);
  if (!uuidPattern.test(ticketId) || !["in_progress", "resolved", "closed"].includes(status)) {
    throw new Error("A valid ticket and status are required");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const resolved = ["resolved", "closed"].includes(status);
  const { error } = await supabase.from("uniplug_support_tickets").update({
    status,
    admin_note: adminNote || null,
    resolved_by: resolved ? viewer.user.id : null,
    resolved_at: resolved ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/requests");
  revalidatePath("/help");
  redirect("/admin/requests?success=ticket_updated");
}

export async function updateMemberStatus(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const status = String(formData.get("status") || "");
  if (!uuidPattern.test(userId) || !["active", "suspended", "pending"].includes(status)) {
    throw new Error("A valid member and status are required");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.rpc("uniplug_set_member_status", { p_user_id: userId, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/dashboard");
  redirect("/admin/members?success=status");
}

export async function markKeyOrderDelivered(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  if (!uuidPattern.test(orderId)) throw new Error("A valid key order is required");
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured");
  const { error } = await admin.from("uniplug_key_orders").update({ fulfillment_status: "delivered", fulfilled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", orderId).eq("payment_status", "paid");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/orders");
  redirect("/admin/orders?success=key_delivered");
}
