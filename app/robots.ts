import type { MetadataRoute } from "next";
import { isKeysStoreRequest } from "@/lib/site-mode";
import { STORE_ORIGIN } from "@/lib/domains";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (await isKeysStoreRequest()) return { rules: [{ userAgent: "*", allow: "/", disallow: ["/checkout", "/payment-return", "/api/"] }], sitemap: `${STORE_ORIGIN}/sitemap.xml` };
  return {
    rules: [{ userAgent: "*", disallow: "/" }]
  };
}
