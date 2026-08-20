import { CatalogExplorer } from "@/components/catalog-explorer";
import { ProcessStrip } from "@/components/home-sections";
import { getViewer } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { isKeysStoreRequest } from "@/lib/site-mode";
import { StorefrontHome } from "@/components/storefront-home";
import { getStorefrontProducts, type StorefrontCategory } from "@/lib/storefront-products";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await isKeysStoreRequest()) {
    const products = await getStorefrontProducts();
    const categoryCounts = products.reduce((counts, product) => {
      counts[product.category] += 1;
      return counts;
    }, {
      software: 0,
      games: 0,
      gaming: 0,
      audio: 0,
      power: 0,
      peripherals: 0,
      storage: 0,
      accessories: 0
    } satisfies Record<StorefrontCategory, number>);
    return (
      <StorefrontHome
        categoryCounts={categoryCounts}
        initialProducts={products.slice(0, 24)}
        initialTotal={products.length}
      />
    );
  }
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
