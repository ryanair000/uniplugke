import type { Metadata } from "next";
import { CatalogExplorer } from "@/components/catalog-explorer";
import { requireMember } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";
import { getTrackedSubscriptions } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore UniPlug streaming, creative, productivity, cloud, security, gaming, and learning services."
};

export default async function ServicesPage() {
  const viewer = await requireMember();
  const isMember = viewer.profile.status === "active";
  const services = await getPublicCatalog();
  const plans = await getMemberPlans(services.map((service) => service.id));
  const subscriptions = viewer.profile.clientId
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
    <div className="catalog-page-minimal">
      <header className="upgrade-shell catalog-page-heading">
        <p className="upgrade-eyebrow">All services</p>
        <h1>Find what fits.</h1>
        <p>Search the member catalog, compare prices, and manage services already in your account.</p>
      </header>
      <div className="upgrade-shell storefront-catalog-shell">
        <CatalogExplorer
          services={services}
          plans={plans}
          isMember={isMember}
          managedServices={managedServices}
        />
      </div>
    </div>
  );
}
