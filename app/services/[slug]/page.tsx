import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanOptions } from "@/components/catalog";
import { categoryLabels } from "@/components/service-card";
import { ServiceArtwork } from "@/components/service-artwork";
import { getViewer } from "@/lib/auth";
import { getMemberPlans, getPublicCatalog, getPublicService } from "@/lib/catalog";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { formatDualPrice, formatUsd } from "@/lib/currency";

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
  return "Available";
}

function comparableName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default async function ServiceDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await getViewer();
  const isMember = viewer.profile?.status === "active";
  const services = await getPublicCatalog();
  const service = services.find((item) => item.slug === slug);
  if (!service) notFound();

  const plans = await getMemberPlans([service.id]);
  const subscriptions = isMember && viewer.profile?.clientId
    ? await getTrackedSubscriptions(viewer.profile.clientId)
    : [];
  const catalogName = comparableName(service.name);
  const activeSubscription = subscriptions.find((subscription) => {
    if (!["active", "due_soon", "trial"].includes(subscription.status)) return false;
    const trackedName = comparableName(subscription.service?.name || subscription.serviceIdentifier || "");
    return trackedName === catalogName
      || trackedName.includes(catalogName)
      || catalogName.includes(trackedName)
      || trackedName.split(" ")[0] === catalogName.split(" ")[0];
  });
  const primaryPlan = plans[0];
  const relatedServices = services
    .filter((item) => item.id !== service.id)
    .sort((a, b) => {
      if (a.category === service.category && b.category !== service.category) return -1;
      if (b.category === service.category && a.category !== service.category) return 1;
      return Number(b.featured) - Number(a.featured);
    })
    .slice(0, 3);

  return (
    <div className="product-page-minimal">
      <div className="upgrade-shell product-decision-layout">
        <section className="product-overview" aria-labelledby="product-title">
          <Link className="back-link" href="/services">← All services</Link>

          <div className="product-identity">
            <ServiceArtwork
              accentColor={service.accentColor}
              className="product-minimal-logo"
              descriptive
              logoText={service.logoText}
              name={service.name}
              slug={service.slug}
            />
            <div>
              <p className="upgrade-eyebrow">{categoryLabels[service.category] ?? service.category}</p>
              <h1 id="product-title">{service.name}</h1>
            </div>
          </div>

          <p className="product-value">{service.shortDescription}</p>
          <div className="product-status-row">
            <span className={service.availabilityStatus}>{availabilityLabel(service.availabilityStatus)}</span>
            <span>{service.fulfillmentLabel}</span>
          </div>

          {isMember && primaryPlan ? (
            <div className="product-starting-price">
              <span>From</span>
              <strong>{formatDualPrice(primaryPlan.priceKes)} <small>/ month</small></strong>
            </div>
          ) : !isMember && service.startingPriceUsd ? (
            <div className="product-starting-price">
              <span>From</span>
              <strong>{formatUsd(service.startingPriceUsd)} <small>/ month</small></strong>
            </div>
          ) : null}

        </section>

        <aside className="product-purchase-card" aria-label={`${service.name} purchase options`}>
          {activeSubscription ? (
            <div className="product-managed-state">
              <span className="managed-kicker">Already in your account</span>
              <h2>Manage {service.name}</h2>
              <p>View access, renewal information, and replacement support in your dashboard.</p>
              <Link className="button button-dark" href={`/dashboard/subscriptions/${activeSubscription.id}`}>
                Manage service
              </Link>
              <Link className="text-link" href="/services">Continue browsing</Link>
            </div>
          ) : isMember ? (
            <>
              <p className="upgrade-eyebrow">Member plan</p>
              <h2>Choose your duration</h2>
              <p className="purchase-card-intro">Select a prepaid term. Your total updates below.</p>
              <PlanOptions plans={plans} service={service} />
            </>
          ) : (
            <div className="product-managed-state">
              <span className="managed-kicker">Member purchase</span>
              <h2>Sign in to choose a plan</h2>
              <p>Member prices and checkout are available after you sign in.</p>
              <Link className="button button-dark" href={`/login?next=${encodeURIComponent(`/services/${service.slug}`)}`}>Member sign in</Link>
            </div>
          )}
        </aside>

        <section className="product-support-summary" aria-label={`${service.name} highlights`}>
          <ul className="product-confidence-list">
            {service.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
          <div className="product-quick-facts">
            <span><small>Activation</small><strong>{service.activationWindow}</strong></span>
            <span><small>Help</small><strong>Support tickets</strong></span>
          </div>
        </section>

        <section className="product-disclosures" aria-label={`${service.name} details`}>
          <details>
            <summary>Compatibility and setup</summary>
            <div className="product-disclosure-content">
              <div>
                <h2>Supported devices</h2>
                <p>{service.supportedDevices.join(", ")}</p>
              </div>
              <div>
                <h2>What you need</h2>
                <ul>{service.setupRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
              </div>
            </div>
          </details>
          <details>
            <summary>Support and common questions</summary>
            <div className="product-disclosure-content product-support-content">
              <p>{service.replacementSummary}</p>
              {service.faqs.map((faq) => (
                <div key={faq.question}>
                  <h2>{faq.question}</h2>
                  <p>{faq.answer}</p>
                </div>
              ))}
              <Link className="text-link" href="/help">Open the help centre →</Link>
            </div>
          </details>
        </section>
      </div>

      {relatedServices.length ? (
        <section className="product-related-minimal" aria-labelledby="related-title">
          <div className="upgrade-shell">
            <div className="product-related-heading">
              <h2 id="related-title">You may also like</h2>
              <Link href="/services">View catalog →</Link>
            </div>
            <div className="product-related-row">
              {relatedServices.map((related) => (
                <Link href={`/services/${related.slug}`} key={related.id}>
                  <ServiceArtwork
                    accentColor={related.accentColor}
                    className="product-related-logo"
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
      <span className="sr-only">{isMember ? "Member pricing is active" : ""}</span>
    </div>
  );
}
