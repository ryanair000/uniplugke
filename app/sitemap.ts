import type { MetadataRoute } from "next";
import { isKeysStoreRequest } from "@/lib/site-mode";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return await isKeysStoreRequest() ? [{ url: "https://uniplug.shop", lastModified: new Date(), changeFrequency: "weekly", priority: 1 }] : [];
}
