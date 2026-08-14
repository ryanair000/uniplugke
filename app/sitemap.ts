import type { MetadataRoute } from "next";
import { isKeysStoreRequest } from "@/lib/site-mode";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await isKeysStoreRequest())) return [];
  const lastModified = new Date();
  return [
    { url: "https://uniplug.shop", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://uniplug.shop/keys/adobe-acrobat", lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: "https://uniplug.shop/keys/windows-11-pro", lastModified, changeFrequency: "weekly", priority: 0.9 }
  ];
}
