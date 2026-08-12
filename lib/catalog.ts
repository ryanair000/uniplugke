import "server-only";

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { buildLokimaxCatalog } from "@/lib/lokimax-services";
import type { CatalogService, MemberPlan, ServiceCategory } from "@/lib/types";

export const publicCatalogFallback: CatalogService[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    slug: "netflix-premium",
    category: "streaming",
    name: "Netflix Premium",
    shortDescription: "Premium entertainment managed through one simple member dashboard.",
    description: "Enjoy a polished streaming setup with clear activation guidance, renewal tracking, and support whenever access needs attention.",
    logoText: "N",
    accentColor: "#e50914",
    features: ["Premium viewing experience", "Renewal tracking", "Member support"],
    supportedDevices: ["Smart TV", "Mobile", "Tablet", "Browser"],
    setupRequirements: ["A supported device", "Stable internet connection"],
    fulfillmentLabel: "Managed access",
    activationWindow: "Usually activated after account verification",
    replacementSummary: "Eligible access issues can be replaced from the member dashboard.",
    faqs: [
      { question: "How do I receive access?", answer: "Activation details appear securely in your dashboard once the service is ready." },
      { question: "Can I report an issue?", answer: "Yes. Active members can report service issues from their dashboard." }
    ],
    availabilityStatus: "available",
    featured: true
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    slug: "spotify-premium",
    category: "music",
    name: "Spotify Premium",
    shortDescription: "Ad-free music, downloads, and member-managed access.",
    description: "Keep your listening experience organised with activation support, clear renewal dates, and a single place to manage access.",
    logoText: "S",
    accentColor: "#1db954",
    features: ["Ad-free listening", "Offline listening", "Account support"],
    supportedDevices: ["Mobile", "Tablet", "Desktop", "Browser"],
    setupRequirements: ["Spotify application", "Internet connection for activation"],
    fulfillmentLabel: "Managed membership",
    activationWindow: "Normally completed after member verification",
    replacementSummary: "Eligible account faults can be reported and tracked online.",
    faqs: [{ question: "Where do I manage the service?", answer: "Your plan, access state, and support history appear in My UniPlug." }],
    availabilityStatus: "available",
    featured: true
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    slug: "canva-pro",
    category: "creative",
    name: "Canva Pro",
    shortDescription: "Premium creative tools for individuals, creators, and small teams.",
    description: "Access a richer design workspace with premium templates, productivity tools, and guided activation through UniPlug.",
    logoText: "C",
    accentColor: "#7d2ae8",
    features: ["Premium templates", "Background tools", "Brand workspace"],
    supportedDevices: ["Browser", "Mobile", "Tablet", "Desktop"],
    setupRequirements: ["An email address you can access"],
    fulfillmentLabel: "Team invitation",
    activationWindow: "Invitation delivered after verification",
    replacementSummary: "Invitation and access issues can be reported from the dashboard.",
    faqs: [{ question: "Do I use my own email?", answer: "The service detail shown after sign-in explains the current activation method." }],
    availabilityStatus: "available",
    featured: true
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    slug: "icloud-plus-200",
    category: "cloud",
    name: "iCloud+ 200GB",
    shortDescription: "More space for photos, files, backups, and everyday device use.",
    description: "A clear cloud-storage option with setup guidance, renewal visibility, and member support from one dashboard.",
    logoText: "i+",
    accentColor: "#0a84ff",
    features: ["Expanded storage", "Backup support", "Family-ready options"],
    supportedDevices: ["iPhone", "iPad", "Mac", "Browser"],
    setupRequirements: ["Compatible Apple account and device"],
    fulfillmentLabel: "Customer account activation",
    activationWindow: "Activation time depends on account verification",
    replacementSummary: "Support reviews account-specific problems before replacement.",
    faqs: [{ question: "Is every device supported?", answer: "Compatibility requirements are checked before activation." }],
    availabilityStatus: "limited",
    featured: false
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    slug: "game-pass-ultimate",
    category: "gaming",
    name: "Game Pass Ultimate",
    shortDescription: "A broad gaming membership for console, PC, and supported cloud play.",
    description: "Discover a managed gaming membership with clear device requirements, activation tracking, and support in My UniPlug.",
    logoText: "X",
    accentColor: "#107c10",
    features: ["Console library", "PC library", "Online multiplayer"],
    supportedDevices: ["Xbox", "Windows PC", "Supported mobile devices"],
    setupRequirements: ["Compatible account", "Supported region and device"],
    fulfillmentLabel: "Account activation",
    activationWindow: "Activation follows account and region verification",
    replacementSummary: "Account faults are checked for eligibility before replacement.",
    faqs: [{ question: "Are region requirements checked?", answer: "Yes. The member plan page shows the applicable requirements before checkout." }],
    availabilityStatus: "available",
    featured: true
  },
  {
    id: "10000000-0000-0000-0000-000000000006",
    slug: "microsoft-365",
    category: "productivity",
    name: "Microsoft 365",
    shortDescription: "Office applications and cloud storage for work, school, and home.",
    description: "Manage productivity access, activation progress, renewal dates, and support from one clean member portal.",
    logoText: "M",
    accentColor: "#f25022",
    features: ["Office applications", "Cloud storage", "Multi-device use"],
    supportedDevices: ["Windows", "Mac", "Mobile", "Browser"],
    setupRequirements: ["Compatible device", "Email access"],
    fulfillmentLabel: "Managed activation",
    activationWindow: "Normally completed after member verification",
    replacementSummary: "Access problems can be reported and followed from the dashboard.",
    faqs: [{ question: "Can I track activation?", answer: "Yes. Activation and renewal information appears in My UniPlug." }],
    availabilityStatus: "available",
    featured: true
  }
];

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeService(row: Record<string, unknown>): CatalogService {
  return {
    id: String(row.id),
    slug: String(row.slug),
    category: String(row.category_slug) as ServiceCategory,
    name: String(row.name),
    shortDescription: String(row.short_description ?? ""),
    description: String(row.description ?? ""),
    logoText: String(row.logo_text ?? "UP"),
    accentColor: String(row.accent_color ?? "#6957ff"),
    features: textArray(row.features),
    supportedDevices: textArray(row.supported_devices),
    setupRequirements: textArray(row.setup_requirements),
    fulfillmentLabel: String(row.fulfillment_label ?? "Managed access"),
    activationWindow: String(row.activation_window ?? "Activation details available after sign-in"),
    replacementSummary: String(row.replacement_summary ?? "Eligible issues can be reported from the dashboard."),
    faqs: Array.isArray(row.faqs)
      ? (row.faqs as Array<Record<string, unknown>>).map((faq) => ({
          question: String(faq.question ?? ""),
          answer: String(faq.answer ?? "")
        }))
      : [],
    availabilityStatus: String(row.availability_status ?? "available") as CatalogService["availabilityStatus"],
    featured: Boolean(row.is_featured),
    startingPriceUsd: row.starting_price_usd == null ? null : Number(row.starting_price_usd)
  };
}

export async function getPublicCatalog() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return publicCatalogFallback;

  const { data, error } = await supabase
    .from("uniplug_catalog_services")
    .select("id,slug,category_slug,name,short_description,description,logo_text,accent_color,features,supported_devices,setup_requirements,fulfillment_label,activation_window,replacement_summary,faqs,availability_status,is_featured,starting_price_usd")
    .eq("is_active", true)
    .order("sort_order");

  const curatedServices = error || !data?.length
    ? publicCatalogFallback
    : (data as Array<Record<string, unknown>>).map(normalizeService);

  const admin = createAdminSupabaseClient();
  if (!admin) return curatedServices;

  const { data: lokimaxServices, error: lokimaxError } = await admin
    .from("services")
    .select("id,service_name")
    .eq("status", "active")
    .order("service_name");

  if (lokimaxError || !lokimaxServices?.length) return curatedServices;
  return buildLokimaxCatalog(lokimaxServices, curatedServices);
}

export async function getPublicService(slug: string) {
  const services = await getPublicCatalog();
  return services.find((service) => service.slug === slug) ?? null;
}

export async function getMemberPlans(serviceIds?: string[]): Promise<MemberPlan[]> {
  const viewer = await getViewer();
  if (!viewer.profile || viewer.profile.status !== "active") return [];

  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("uniplug_member_plans")
    .select("id,service_id,plan_name,plan_code,price_kes,compare_at_kes,billing_cycle,plan_features,availability_status,service:uniplug_catalog_services(slug,name)")
    .eq("is_active", true)
    .order("sort_order");

  if (serviceIds?.length) query = query.in("service_id", serviceIds);
  const { data, error } = await query;
  if (error || !data) return [];

  return (data as unknown as Array<Record<string, unknown>>).map((row) => {
    const service = row.service as { slug?: string; name?: string } | null;
    return {
      id: String(row.id),
      serviceId: String(row.service_id),
      serviceSlug: String(service?.slug ?? ""),
      serviceName: String(service?.name ?? "Digital service"),
      planName: String(row.plan_name),
      planCode: String(row.plan_code),
      priceKes: Number(row.price_kes),
      compareAtKes: row.compare_at_kes == null ? null : Number(row.compare_at_kes),
      billingCycle: String(row.billing_cycle) as MemberPlan["billingCycle"],
      features: textArray(row.plan_features),
      availabilityStatus: String(row.availability_status) as MemberPlan["availabilityStatus"]
    };
  });
}
