import type { Metadata } from "next";
import { CatalogExplorer } from "@/components/catalog-explorer";
import { PublicPageIntro } from "@/components/public-page";
import { requireMember } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore UniPlug streaming, creative, productivity, cloud, security, gaming, and learning services."
};

export default async function ServicesPage() {
  await requireMember();
  const services = await getPublicCatalog();
  const plans = await getMemberPlans(services.map((service) => service.id));

  return (
    <div className="public-page services-public-page">
      <PublicPageIntro
        eyebrow="Full catalog"
        title="Find the right service, faster."
        description="Search by name or category, compare KSh and USD prices, and open any service for setup, activation, and support details."
      />
      <section className="public-page-shell public-catalog-page" aria-label="Service catalog">
        <CatalogExplorer services={services} plans={plans} isMember />
      </section>
    </div>
  );
}
