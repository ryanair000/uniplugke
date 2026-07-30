import Link from "next/link";
import { CatalogExplorer } from "@/components/catalog-explorer";
import { ProcessStrip } from "@/components/home-sections";
import { ServiceArtwork } from "@/components/service-artwork";
import { requireMember } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireMember();
  const services = await getPublicCatalog();
  const plans = await getMemberPlans(services.map((service) => service.id));

  return (
    <div className="home-page upgrade-home">
      <section className="upgrade-home-hero">
        <div className="upgrade-shell upgrade-home-hero-grid">
          <div className="upgrade-home-copy">
            <p className="upgrade-eyebrow">Digital services, backed by local support</p>
            <h1>The services you use. One account. Less hassle.</h1>
            <p className="upgrade-home-lead">
              Discover digital memberships, understand how activation works,
              and manage orders, renewals, and support from one place.
            </p>
            <div className="upgrade-home-actions">
              <Link className="button button-primary" href="/services">Browse services</Link>
              <Link className="button button-light" href="/dashboard">Open My UniPlug</Link>
            </div>
            <ul className="upgrade-home-proof" aria-label="UniPlug benefits">
              <li>Private, invitation-only access</li>
              <li>Kenyan WhatsApp support</li>
              <li>Renewal and activation tracking</li>
            </ul>
          </div>

          <div className="upgrade-home-showcase" aria-label="Popular services available on UniPlug">
            <div className="showcase-heading">
              <span>Popular now</span>
              <strong>{services.length} services available</strong>
            </div>
            <div className="showcase-service-list">
              {services.slice(0, 4).map((service) => (
                <Link href={`/services/${service.slug}`} key={service.id}>
                  <ServiceArtwork
                    accentColor={service.accentColor}
                    className="showcase-service-logo"
                    logoText={service.logoText}
                    name={service.name}
                    slug={service.slug}
                  />
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.shortDescription}</small>
                  </span>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
            <p className="showcase-note">
              Prices are shown in KSh with approximate USD equivalents.
            </p>
          </div>
        </div>
      </section>
      <CatalogExplorer
        services={services}
        plans={plans}
        isMember
        variant="homepage"
      />
      <ProcessStrip />
    </div>
  );
}
