import { CatalogExplorer } from "@/components/catalog";
import { ProcessStrip, TrustStrip } from "@/components/home-sections";
import { getViewer } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await getPublicCatalog();
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  const plans = isMember
    ? await getMemberPlans(services.map((service) => service.id))
    : [];

  return (
    <div className="home-page">
      <CatalogExplorer
        services={services}
        plans={plans}
        isMember={isMember}
        variant="homepage"
      />
      <ProcessStrip />
      <TrustStrip />
    </div>
  );
}
