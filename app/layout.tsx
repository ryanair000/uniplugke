import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "@/app/globals.css";
import "@/app/phase2.css";
import "@/app/upgrade.css";
import { CartProvider } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site";
import { getViewer } from "@/lib/auth";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://uniplug.shop"),
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
        url: "/og-uniplug.png",
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
    images: ["/og-uniplug.png"]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
