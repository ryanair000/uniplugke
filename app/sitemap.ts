import type { MetadataRoute } from "next";
import { getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop";
  const services = await getPublicCatalog();
  const publicPages = [
    { path: "/about", priority: 0.7 },
    { path: "/help", priority: 0.75 },
    { path: "/contact", priority: 0.65 },
    { path: "/privacy", priority: 0.45 },
    { path: "/terms", priority: 0.45 }
  ];
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/services`, changeFrequency: "daily", priority: 0.9 },
    ...publicPages.map((page) => ({
      url: `${baseUrl}${page.path}`,
      changeFrequency: "monthly" as const,
      priority: page.priority
    })),
    ...services.map((service) => ({
      url: `${baseUrl}/services/${service.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75
    }))
  ];
}
