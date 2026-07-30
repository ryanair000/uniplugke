import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { formatDualPrice } from "@/lib/currency";
import type { CatalogService, MemberPlan } from "@/lib/types";

export const categoryLabels: Record<string, string> = {
  all: "All services",
  streaming: "Streaming",
  music: "Music",
  creative: "Creative",
  ai: "AI tools",
  productivity: "Productivity",
  cloud: "Cloud & storage",
  security: "Security & VPN",
  gaming: "Gaming",
  learning: "Learning"
};

function availabilityLabel(status: CatalogService["availabilityStatus"]) {
  if (status === "limited") return "Limited availability";
  if (status === "coming_soon") return "Coming soon";
  return "Available today";
}

export function CatalogServiceCard({
  service,
  plan,
  isMember
}: {
  service: CatalogService;
  plan?: MemberPlan;
  isMember: boolean;
}) {
  const deviceCount = service.supportedDevices.length;
  const primaryFeature = service.features[0] || service.fulfillmentLabel;

  return (
    <article className="catalog-card">
      <Link
        className="catalog-card-link"
        href={`/services/${service.slug}`}
        aria-label={`View ${service.name}`}
      >
        <div className="catalog-card-top">
          <ServiceArtwork
            accentColor={service.accentColor}
            className="catalog-card-logo"
            logoText={service.logoText}
            name={service.name}
            slug={service.slug}
          />
          <span className={`catalog-availability ${service.availabilityStatus}`}>
            {availabilityLabel(service.availabilityStatus)}
          </span>
        </div>

        <div className="catalog-card-heading">
          <span>{categoryLabels[service.category] ?? service.category}</span>
          <h3>{service.name}</h3>
        </div>

        <p className="catalog-card-description">{service.shortDescription}</p>

        <div className="catalog-card-facts" aria-label={`${service.name} highlights`}>
          <span>{primaryFeature}</span>
          <span>{deviceCount} supported device{deviceCount === 1 ? "" : "s"}</span>
        </div>

        <div className="catalog-card-footer">
          <div>
            {isMember && plan ? (
              <>
                <strong>{formatDualPrice(plan.priceKes)}</strong>
                <small>per {plan.billingCycle.replace("ly", "")}</small>
              </>
            ) : (
              <>
                <strong>Invitation required</strong>
                <small>Private client pricing</small>
              </>
            )}
          </div>
          <span className="catalog-card-action">
            View service <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
