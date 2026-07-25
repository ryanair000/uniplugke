import type { MetadataRoute } from "next";
import { getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop";
  const services = await getPublicCatalog();
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/services`, changeFrequency: "daily", priority: 0.9 },
    ...services.map((service) => ({
      url: `${baseUrl}/services/${service.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75
    }))
  ];
}
