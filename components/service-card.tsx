import Image from "next/image";
import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { formatDualPrice } from "@/lib/currency";
import { planDurationLabel } from "@/lib/plan-durations";
import type { KeyProduct } from "@/lib/key-products";
import type { CatalogService } from "@/lib/types";

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
  managementHref
}: {
  service: CatalogService;
  managementHref?: string;
}) {
  const href = managementHref || `/services/${service.slug}`;
  const action = managementHref ? "Manage" : "View service";
  const startingOffer = service.publicPlans
    .flatMap((candidate) => candidate.offers)
    .sort((a, b) => a.priceKes - b.priceKes)[0];

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
            {startingOffer ? (
              <>
                <strong>{formatDualPrice(startingOffer.priceKes)}</strong>
                <small>per {planDurationLabel(startingOffer.durationMonths)}</small>
              </>
            ) : (
              <strong>Price unavailable</strong>
            )}
          </div>
          <span className="catalog-card-action">
            {action} <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}

export function CatalogSoftwareCard({ product }: { product: KeyProduct }) {
  const href = `https://uniplug.shop/checkout?product=${product.slug}`;

  return (
    <article className="catalog-card is-software">
      <Link
        aria-label={`Buy ${product.name} software`}
        className="catalog-card-link"
        href={href}
      >
        <div className="catalog-card-top">
          <span className="catalog-card-logo catalog-software-logo">
            <Image
              alt=""
              fill
              sizes="46px"
              src={product.image}
            />
          </span>
          <span className="catalog-availability available">Available</span>
        </div>

        <div className="catalog-card-heading">
          <span>Software</span>
          <h3>{product.name}</h3>
        </div>

        <p className="catalog-card-description">{product.description}</p>

        <div className="catalog-card-footer">
          <div>
            <strong>{formatDualPrice(product.priceKes)}</strong>
            <small>per {product.term}</small>
          </div>
          <span className="catalog-card-action">
            Buy software <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}

