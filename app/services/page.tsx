import type { Metadata } from "next";
import { CatalogExplorer } from "@/components/catalog";
import { PublicPageIntro } from "@/components/public-page";
import { getViewer } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore UniPlug streaming, creative, productivity, cloud, security, gaming, and learning services."
};

export default async function ServicesPage() {
  const services = await getPublicCatalog();
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  const plans = isMember
    ? await getMemberPlans(services.map((service) => service.id))
    : [];

  return (
    <div className="public-page services-public-page">
      <PublicPageIntro
        eyebrow="Full catalog"
        title="Services for how you watch, create, work, store, and play."
        description="Open any service to review supported devices, setup requirements, activation guidance, and current member options."
      />
      <section className="public-page-shell public-catalog-page" aria-label="Service catalog">
        <CatalogExplorer services={services} plans={plans} isMember={isMember} />
      </section>
    </div>
  );
}
