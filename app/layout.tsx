import type { Metadata } from "next";
import "@/app/globals.css";
import { CartProvider } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop"),
  title: { default: "UniPlug | Digital services, simply managed", template: "%s | UniPlug" },
  description: "Discover and manage streaming, creative, productivity, cloud, security, and gaming services through one clean member portal.",
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "UniPlug", title: "UniPlug | Digital services, simply managed", description: "A clean catalog and private member portal for everyday digital services." }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CartProvider><SiteHeader /><main>{children}</main><SiteFooter /></CartProvider></body></html>;
}
