import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanOptions } from "@/components/catalog";
import { categoryLabels } from "@/components/service-card";
import { ServiceArtwork } from "@/components/service-artwork";
import { requireMember } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog, getPublicService } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getPublicService(slug);
  return service
    ? { title: service.name, description: service.shortDescription }
    : { title: "Service not found" };
}

function availabilityLabel(value: "available" | "limited" | "coming_soon") {
  if (value === "limited") return "Limited availability";
  if (value === "coming_soon") return "Coming soon";
  return "Available today";
}

export default async function ServiceDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireMember();
  const services = await getPublicCatalog();
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();

  const plans = await getMemberPlans([service.id]);
  const relatedServices = services
    .filter((item) => item.id !== service.id)
    .sort((a, b) => {
      if (a.category === service.category && b.category !== service.category) return -1;
      if (b.category === service.category && a.category !== service.category) return 1;
      return Number(b.featured) - Number(a.featured);
    })
    .slice(0, 3);
  return (
    <div className="service-detail upgrade-service-detail">
      <section className="upgrade-product-hero">
        <div className="upgrade-shell upgrade-product-hero-grid">
          <div className="upgrade-product-copy">
            <Link className="back-link" href="/services">← Back to all services</Link>
            <p className="upgrade-eyebrow">
              {categoryLabels[service.category] ?? service.category}
            </p>
            <h1>{service.name}</h1>
            <p>{service.description}</p>
            <div className="upgrade-product-badges">
              <span>{service.fulfillmentLabel}</span>
              <span className={service.availabilityStatus}>
                {availabilityLabel(service.availabilityStatus)}
              </span>
            </div>
          </div>
          <div className="upgrade-product-art">
            <ServiceArtwork
              accentColor={service.accentColor}
              className="upgrade-product-logo"
              descriptive
              logoText={service.logoText}
              name={service.name}
              slug={service.slug}
            />
            <div>
              <span>Typical activation</span>
              <strong>{service.activationWindow}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="upgrade-shell upgrade-product-layout member-layout">
        <main className="upgrade-product-content">
          <section className="upgrade-product-facts" aria-label={`${service.name} overview`}>
            <article>
              <span>What you get</span>
              <strong>{service.features[0] || service.fulfillmentLabel}</strong>
            </article>
            <article>
              <span>Works on</span>
              <strong>{service.supportedDevices.length} supported devices</strong>
            </article>
            <article>
              <span>Support</span>
              <strong>Dashboard and WhatsApp</strong>
            </article>
          </section>

          <section className="upgrade-detail-section">
            <div className="upgrade-detail-heading">
              <p className="upgrade-eyebrow">Included</p>
              <h2>What comes with this service</h2>
            </div>
            <div className="upgrade-feature-list">
              {service.features.map((feature) => (
                <div key={feature}><span aria-hidden="true">✓</span>{feature}</div>
              ))}
            </div>
          </section>

          <section className="upgrade-detail-section upgrade-detail-split">
            <div>
              <div className="upgrade-detail-heading">
                <p className="upgrade-eyebrow">Compatibility</p>
                <h2>Supported devices</h2>
              </div>
              <div className="upgrade-device-list">
                {service.supportedDevices.map((device) => <span key={device}>{device}</span>)}
              </div>
            </div>
            <div>
              <div className="upgrade-detail-heading">
                <p className="upgrade-eyebrow">Before activation</p>
                <h2>What you will need</h2>
              </div>
              <ol className="upgrade-requirement-list">
                {service.setupRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ol>
            </div>
          </section>

          <section className="upgrade-detail-section upgrade-support-note">
            <div>
              <p className="upgrade-eyebrow">After purchase</p>
              <h2>Support and replacements</h2>
            </div>
            <p>{service.replacementSummary}</p>
            <Link className="text-link" href="/help">See how support works →</Link>
          </section>

          <section className="upgrade-detail-section">
            <div className="upgrade-detail-heading">
              <p className="upgrade-eyebrow">Common questions</p>
              <h2>Before you choose a plan</h2>
            </div>
            <div className="upgrade-faq-list">
              {service.faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
              <details>
                <summary>Where will I see activation and renewal updates?</summary>
                <p>Active members can follow order, activation, and renewal status from My UniPlug.</p>
              </details>
              <details>
                <summary>How do I get help if something goes wrong?</summary>
                <p>Use the relevant subscription in your dashboard or contact the Kenyan support team on WhatsApp.</p>
              </details>
            </div>
          </section>
        </main>

        <aside className="upgrade-product-aside">
          <div className="upgrade-member-plans">
            <p className="upgrade-eyebrow">Member plans</p>
            <h2>Choose your plan</h2>
            <p>Choose 3 months, 6 months, 12 months, or 3 years. KSh totals and approximate USD equivalents are shown before checkout.</p>
            <PlanOptions plans={plans} service={service} />
          </div>
        </aside>
      </section>

      {relatedServices.length ? (
        <section className="upgrade-related-services">
          <div className="upgrade-shell">
            <div className="catalog-section-heading">
              <div>
                <p className="upgrade-eyebrow">Keep exploring</p>
                <h2>Other services you may need</h2>
              </div>
              <Link className="text-link" href="/services">View full catalog →</Link>
            </div>
            <div className="upgrade-related-grid">
              {relatedServices.map((related) => (
                <Link href={`/services/${related.slug}`} key={related.id}>
                  <ServiceArtwork
                    accentColor={related.accentColor}
                    className="upgrade-related-logo"
                    logoText={related.logoText}
                    name={related.name}
                    slug={related.slug}
                  />
                  <span>
                    <small>{categoryLabels[related.category]}</small>
                    <strong>{related.name}</strong>
                  </span>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

    </div>
  );
}
