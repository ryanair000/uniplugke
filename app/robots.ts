import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop";
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/services/"], disallow: ["/dashboard", "/checkout", "/admin", "/api/"] }
    ],
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
