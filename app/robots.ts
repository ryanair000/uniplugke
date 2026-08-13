import type { MetadataRoute } from "next";
import { isKeysStoreRequest } from "@/lib/site-mode";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (await isKeysStoreRequest()) return { rules: [{ userAgent: "*", allow: "/", disallow: ["/checkout", "/payment-return", "/api/"] }], sitemap: "https://uniplug.shop/sitemap.xml" };
  return {
    rules: [{ userAgent: "*", disallow: "/" }]
  };
}
