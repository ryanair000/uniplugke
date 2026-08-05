import Link from "next/link";
import { CatalogExplorer } from "@/components/catalog-explorer";
import { ProcessStrip } from "@/components/home-sections";
import { requireMember } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";
import { getTrackedSubscriptions } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
    <div className="storefront-home">
      <section className="catalog-first-hero">
        <div className="upgrade-shell catalog-first-hero-inner">
          <div>
            <p className="upgrade-eyebrow">Private member catalog</p>
            <h1>Your digital services, in one place.</h1>
            <p>Choose a plan, track activation, and manage every renewal from your UniPlug account.</p>
          </div>
          <div className="catalog-first-actions">
            <Link className="button button-dark" href="/dashboard/subscriptions">Manage my services</Link>
            <Link className="text-link" href="/help">Get support <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

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
