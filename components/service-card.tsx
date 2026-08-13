import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { formatDualPrice, formatUsd } from "@/lib/currency";
import type { CatalogService, MemberPlan } from "@/lib/types";

export const categoryLabels: Record<string, string> = {
  all: "All services",
  streaming: "Watch",
  music: "Listen",
  creative: "Create",
  ai: "AI tools",
  productivity: "Work",
  cloud: "Store & cloud",
  security: "Security",
  gaming: "Play",
  learning: "Learn"
};

function availabilityLabel(status: CatalogService["availabilityStatus"]) {
  if (status === "limited") return "Limited";
  if (status === "coming_soon") return "Coming soon";
  return "Available";
}

export function CatalogServiceCard({
  service,
  plan,
  isMember,
  managementHref
}: {
  service: CatalogService;
  plan?: MemberPlan;
  isMember: boolean;
  managementHref?: string;
}) {
  const href = managementHref || `/services/${service.slug}`;
  const action = managementHref ? "Manage" : "View service";

  return (
    <article className={`catalog-card${managementHref ? " is-managed" : ""}`}>
      <Link
        className="catalog-card-link"
        href={href}
        aria-label={`${action} ${service.name}`}
      >
        <div className="catalog-card-top">
          <ServiceArtwork
            accentColor={service.accentColor}
            className="catalog-card-logo"
            logoText={service.logoText}
            name={service.name}
            slug={service.slug}
          />
          <span className={`catalog-availability ${managementHref ? "managed" : service.availabilityStatus}`}>
            {managementHref ? "In your account" : availabilityLabel(service.availabilityStatus)}
          </span>
        </div>

        <div className="catalog-card-heading">
          <span>{categoryLabels[service.category] ?? service.category}</span>
          <h3>{service.name}</h3>
        </div>

        <p className="catalog-card-description">{service.shortDescription}</p>

        <div className="catalog-card-footer">
          <div>
            {isMember && plan ? (
              <>
                <strong>{formatDualPrice(plan.priceKes)}</strong>
                <small>per month</small>
              </>
            ) : !isMember && service.startingPriceUsd ? (
              <>
                <strong>{formatUsd(service.startingPriceUsd)}</strong>
                <small>starting price</small>
              </>
            ) : (
              <strong>Price unavailable</strong>
            )}
          </div>
          <span className="catalog-card-action">
            {action} <span aria-hidden="true">â†’</span>
          </span>
        </div>
      </Link>
    </article>
  );
}

