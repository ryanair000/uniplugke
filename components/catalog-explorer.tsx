"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CatalogServiceCard,
  CatalogSoftwareCard,
  categoryLabels
} from "@/components/service-card";
import { KEY_PRODUCTS } from "@/lib/key-products";
import type { CatalogService, MemberPlan } from "@/lib/types";

export type ManagedCatalogService = {
  id: string;
  serviceName: string;
};

const featuredOrder = [
  "netflix-premium",
  "spotify-premium",
  "canva-pro",
  "microsoft-365",
  "game-pass-ultimate",
  "icloud-plus-200"
];

const softwareProducts = Object.values(KEY_PRODUCTS);

function comparableName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findManagedService(service: CatalogService, managedServices: ManagedCatalogService[]) {
  const catalogName = comparableName(service.name);
  const catalogLead = catalogName.split(" ")[0];
  return managedServices.find((managed) => {
    const managedName = comparableName(managed.serviceName);
    return managedName === catalogName
      || managedName.includes(catalogName)
      || catalogName.includes(managedName)
      || (catalogLead.length > 3 && managedName.split(" ")[0] === catalogLead);
  });
}

export function CatalogExplorer({
  services,
  plans,
  isMember,
  managedServices = [],
  variant = "default"
}: {
  services: CatalogService[];
  plans: MemberPlan[];
  isMember: boolean;
  managedServices?: ManagedCatalogService[];
  variant?: "default" | "homepage";
}) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const browsableServices = useMemo(
    () => isMember ? services : services.filter((service) => service.startingPriceUsd != null),
    [isMember, services]
  );
  const planByService = useMemo(() => {
    const map = new Map<string, MemberPlan>();
    plans.forEach((plan) => {
      if (!map.has(plan.serviceId)) map.set(plan.serviceId, plan);
    });
    return map;
  }, [plans]);

  const categories = useMemo(() => {
    const available = Array.from(new Set(browsableServices.map((service) => service.category)));
    return ["all", ...available, "software"];
  }, [browsableServices]);

  const visibleServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return browsableServices.filter((service) => {
      const categoryMatch = category === "all" || service.category === category;
      const searchableText = [
        service.name,
        service.shortDescription,
        categoryLabels[service.category],
        ...service.features,
        ...service.supportedDevices
      ].join(" ").toLowerCase();
      return categoryMatch && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [browsableServices, category, search]);

  const visibleSoftware = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (category !== "all" && category !== "software") return [];
    return softwareProducts.filter((product) => {
      const searchableText = [
        product.name,
        product.categoryLabel,
        product.description,
        product.details,
        ...product.facts.flatMap((fact) => [fact.label, fact.value]),
        ...product.pendingTerms,
        "software licence key"
      ].join(" ").toLowerCase();
      return !normalizedSearch || searchableText.includes(normalizedSearch);
    });
  }, [category, search]);

  const hasFilters = category !== "all" || search.trim().length > 0;
  const orderedServices = useMemo(() => {
    if (variant !== "homepage") return visibleServices;
    return [...visibleServices].sort((a, b) => {
      const aIndex = featuredOrder.indexOf(a.slug);
      const bIndex = featuredOrder.indexOf(b.slug);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex)
        - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
  }, [variant, visibleServices]);
  const visibleEntries = useMemo(() => [
    ...orderedServices.map((service) => ({ kind: "service" as const, service })),
    ...visibleSoftware.map((product) => ({ kind: "software" as const, product }))
  ], [orderedServices, visibleSoftware]);
  const displayedEntries = visibleEntries;

  function resetFilters() {
    setCategory("all");
    setSearch("");
  }

  return (
    <section
      className={`catalog-browser ${variant === "homepage" ? "catalog-browser-home" : "catalog-browser-page"}`}
      aria-labelledby={variant === "homepage" ? "catalog-title" : undefined}
    >
      <div className="catalog-browser-head">
        {variant === "homepage" ? <h2 id="catalog-title">Choose your next service or software.</h2> : null}
        {variant === "homepage" ? (
          <Link className="catalog-manage-link" href={isMember ? "/dashboard/subscriptions" : "/login"}>
            {isMember ? "My subscriptions" : "Member sign in"} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <div className="catalog-search-row">
        <label className="catalog-search">
          <span className="sr-only">Search services and software</span>
          <input
            type="search"
            placeholder="Search services and software…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="catalog-result-count" aria-live="polite">
          {visibleEntries.length} result{visibleEntries.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="catalog-filter-row">
        <div className="catalog-category-row" aria-label="Catalog categories">
          {categories.map((key) => (
            <button
              type="button"
              key={key}
              className={category === key ? "active" : ""}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {key === "all" ? "All" : categoryLabels[key] ?? (key === "software" ? "Software" : key)}
            </button>
          ))}
        </div>
        {hasFilters ? (
          <button className="catalog-clear" type="button" onClick={resetFilters}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="catalog-card-grid">
        {displayedEntries.map((entry) => {
          if (entry.kind === "software") {
            return <CatalogSoftwareCard isMember={isMember} key={`software-${entry.product.slug}`} product={entry.product} />;
          }
          const managed = findManagedService(entry.service, managedServices);
          return (
            <CatalogServiceCard
              isMember={isMember}
              key={entry.service.id}
              plan={planByService.get(entry.service.id)}
              service={entry.service}
              managementHref={managed ? `/dashboard/subscriptions/${managed.id}` : undefined}
            />
          );
        })}
      </div>

      {variant === "homepage" && visibleEntries.length > displayedEntries.length ? (
        <div className="catalog-view-all">
          <Link href="/services">View all {visibleEntries.length} catalog items <span aria-hidden="true">→</span></Link>
        </div>
      ) : null}

      {!visibleEntries.length ? (
        <div className="catalog-empty">
          <h2>No matching catalog items</h2>
          <p>Try another search or clear the active category.</p>
          <button className="button button-light" type="button" onClick={resetFilters}>
            Show everything
          </button>
        </div>
      ) : null}

      {variant === "homepage" ? (
        <div className="catalog-trust-strip" aria-label="UniPlug member benefits">
          <span><strong>Ticket support</strong> in your account</span>
          <span><strong>Instant replacement</strong> when eligible</span>
          <span><strong>Renewal tracking</strong> in your dashboard</span>
        </div>
      ) : null}
    </section>
  );
}

