import { CatalogExplorer } from "@/components/catalog-explorer";
import { ProcessStrip } from "@/components/home-sections";
import { getViewer } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";
import { getTrackedSubscriptions } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  const services = await getPublicCatalog();
  const plans = await getMemberPlans(services.map((service) => service.id));
  const subscriptions = isMember && viewer.profile?.clientId
    ? await getTrackedSubscriptions(viewer.profile.clientId)
    : [];
  const managedServices = subscriptions
    .filter((subscription) => ["active", "due_soon", "trial"].includes(subscription.status))
    .map((subscription) => ({
      id: subscription.id,
      serviceName: subscription.service?.name || subscription.serviceIdentifier || ""
    }))
    .filter((subscription) => subscription.serviceName);

  return (
    <div className="storefront-home">
      <div className="upgrade-shell storefront-catalog-shell">
        <CatalogExplorer
          services={services}
          plans={plans}
          isMember={isMember}
          managedServices={managedServices}
          variant="homepage"
        />
      </div>

      <ProcessStrip />
    </div>
  );
}
