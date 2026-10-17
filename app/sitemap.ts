import type { MetadataRoute } from "next";
import { isKeysStoreRequest } from "@/lib/site-mode";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { STORE_ORIGIN } from "@/lib/domains";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await isKeysStoreRequest())) return [];
  const lastModified = new Date();
  const products = await getStorefrontProducts();
  return [
    { url: STORE_ORIGIN, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${STORE_ORIGIN}/keys/adobe-acrobat`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${STORE_ORIGIN}/keys/windows-11-pro`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...products
      .filter((product) => product.fulfillment === "physical")
      .map((product) => ({
        url: `${STORE_ORIGIN}/products/${product.slug}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: product.featured ? 0.8 : 0.6
      }))
  ];
}
