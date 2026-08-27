import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "@/app/globals.css";
import "@/app/phase2.css";
import "@/app/upgrade.css";
import "@/app/member-wallet.css";
import "@/app/key-store.css";
import "@/app/storefront-header.css";
import "@/app/store-commerce.css";
import "@/app/brand.css";
import { CartProvider } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site";
import { getViewer } from "@/lib/auth";
import { KeyStoreFooter, KeyStoreHeader } from "@/components/key-store";
import { isKeysStoreRequest } from "@/lib/site-mode";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist"
});

export async function generateMetadata(): Promise<Metadata> {
  const isKeysStore = await isKeysStoreRequest();
  if (isKeysStore) return {
    metadataBase: new URL("https://uniplug.shop"),
    title: { default: "UniPlug | Software, devices and accessories", template: "%s | UniPlug" },
    description: "Shop software keys, devices and accessories in KSh, with delivery across Kenya.",
    robots: { index: true, follow: true },
    openGraph: { type: "website", siteName: "UniPlug", title: "Software, devices and gaming gear", description: "Shop software keys and everyday tech with delivery across Kenya.", images: ["/opengraph-image"] }
  };
  return {
  metadataBase: new URL(process.env.NEXT_PUBLIC_VIP_SITE_URL || "https://vip.uniplug.shop"),
  title: { default: "UniPlug | Digital services, simply managed", template: "%s | UniPlug" },
  description: "Discover and manage streaming, creative, productivity, cloud, security, and gaming services through one clean member portal.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
  openGraph: {
    type: "website",
    siteName: "UniPlug",
    title: "UniPlug | Digital services, simply managed",
    description: "A clean catalog and private member portal for everyday digital services.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "UniPlug — Digital services, simply managed."
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UniPlug | Digital services, simply managed",
    description: "Discover digital services and manage orders, renewals, and support in one place.",
    images: ["/opengraph-image"]
  }
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isKeysStore = await isKeysStoreRequest();
  if (isKeysStore) {
    const viewer = await getViewer();
    return <html className={geist.variable} lang="en"><body><KeyStoreHeader signedIn={Boolean(viewer.user)} /><main>{children}</main><KeyStoreFooter /></body></html>;
  }
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  return (
    <html className={geist.variable} lang="en">
      <body>
        <CartProvider enabled={isMember}>
          <SiteHeader />
          <main>{children}</main>
          {isMember ? <SiteFooter /> : null}
        </CartProvider>
      </body>
    </html>
  );
}
