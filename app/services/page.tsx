import type { Metadata } from "next";
import { CatalogExplorer } from "@/components/catalog-explorer";
import { getViewer } from "@/lib/auth";
import { getPublicCatalog } from "@/lib/catalog";
import { getTrackedSubscriptions } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Explore UniPlug digital services and software with exact public KSh catalogue pricing."
};

export default async function ServicesPage() {
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  const services = await getPublicCatalog();
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
    <div className="catalog-page-minimal">
      <header className="upgrade-shell catalog-page-heading">
        <p className="upgrade-eyebrow">Full catalog</p>
        <h1>Find what fits.</h1>
        <p>Search services and software, compare prices, and manage services already in your account.</p>
      </header>
      <div className="upgrade-shell storefront-catalog-shell">
        <CatalogExplorer
          services={services}
          isMember={isMember}
          managedServices={managedServices}
        />
      </div>
    </div>
  );
}
