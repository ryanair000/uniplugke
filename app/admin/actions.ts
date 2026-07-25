"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function slug(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createCatalogService(formData: FormData) {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const name = String(formData.get("name") || "").trim();
  const serviceSlug = slug(formData.get("slug") || name);
  if (!name || !serviceSlug) throw new Error("Name and slug are required");
  const { error } = await supabase.from("uniplug_catalog_services").insert({
    name,
    slug: serviceSlug,
    category_slug: String(formData.get("category") || "productivity"),
    short_description: String(formData.get("shortDescription") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    logo_text: String(formData.get("logoText") || "UP").trim().slice(0, 3),
    accent_color: String(formData.get("accentColor") || "#6957ff"),
    fulfillment_label: String(formData.get("fulfillmentLabel") || "Managed access"),
    activation_window: String(formData.get("activationWindow") || "Activation details available after sign-in"),
    replacement_summary: String(formData.get("replacementSummary") || "Eligible issues can be reported from the dashboard."),
    is_active: true
  });
  if (error) throw new Error(error.message);
  revalidatePath("/"); revalidatePath("/services"); revalidatePath("/admin");
}

export async function createMemberPlan(formData: FormData) {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const price = Number(formData.get("priceKes"));
  if (!Number.isFinite(price) || price < 1) throw new Error("A valid price is required");
  const planName = String(formData.get("planName") || "").trim();
  const planCode = slug(formData.get("planCode") || planName);
  const { error } = await supabase.from("uniplug_member_plans").insert({
    service_id: String(formData.get("serviceId")),
    plan_name: planName,
    plan_code: planCode,
    price_kes: price,
    compare_at_kes: formData.get("compareAtKes") ? Number(formData.get("compareAtKes")) : null,
    billing_cycle: String(formData.get("billingCycle") || "monthly"),
    availability_status: "available",
    is_active: true
  });
  if (error) throw new Error(error.message);
  revalidatePath("/"); revalidatePath("/services"); revalidatePath("/admin");
}
