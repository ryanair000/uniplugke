"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CatalogServiceCard, categoryLabels } from "@/components/service-card";
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
  const planByService = useMemo(() => {
    const map = new Map<string, MemberPlan>();
    plans.forEach((plan) => {
      if (!map.has(plan.serviceId)) map.set(plan.serviceId, plan);
    });
    return map;
  }, [plans]);

  const categories = useMemo(() => {
    const available = Array.from(new Set(services.map((service) => service.category)));
    return ["all", ...available];
  }, [services]);

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return services.filter((service) => {
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
  }, [category, search, services]);

  const hasFilters = category !== "all" || search.trim().length > 0;
  const orderedVisible = useMemo(() => {
    if (variant !== "homepage") return visible;
    return [...visible].sort((a, b) => {
      const aIndex = featuredOrder.indexOf(a.slug);
      const bIndex = featuredOrder.indexOf(b.slug);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex)
        - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
  }, [variant, visible]);
  const displayedServices = variant === "homepage" && !hasFilters
    ? orderedVisible.slice(0, 9)
    : orderedVisible;

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
        <div>
          {variant === "homepage" ? <p className="upgrade-eyebrow">Member catalog</p> : null}
          {variant === "homepage" ? <h2 id="catalog-title">Choose your next service.</h2> : null}
          <p>{services.length} services with local support and member-managed access.</p>
        </div>
        {variant === "homepage" ? (
          <Link className="catalog-manage-link" href={isMember ? "/dashboard/subscriptions" : "/login"}>
            {isMember ? "My subscriptions" : "Member sign in"} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      <div className="catalog-search-row">
        <label className="catalog-search">
          <span className="sr-only">Search services</span>
          <input
            type="search"
            placeholder="Search Netflix, music, cloud…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="catalog-result-count" aria-live="polite">
          {visible.length} result{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="catalog-filter-row">
        <div className="catalog-category-row" aria-label="Service categories">
          {categories.map((key) => (
            <button
              type="button"
              key={key}
              className={category === key ? "active" : ""}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {categoryLabels[key] ?? key}
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
        {displayedServices.map((service) => {
          const managed = findManagedService(service, managedServices);
          return (
            <CatalogServiceCard
              isMember={isMember}
              key={service.id}
              plan={planByService.get(service.id)}
              service={service}
              managementHref={managed ? `/dashboard/subscriptions/${managed.id}` : undefined}
            />
          );
        })}
      </div>

      {variant === "homepage" && visible.length > displayedServices.length ? (
        <div className="catalog-view-all">
          <Link href="/services">View all {visible.length} services <span aria-hidden="true">→</span></Link>
        </div>
      ) : null}

      {!visible.length ? (
        <div className="catalog-empty">
          <h2>No matching services</h2>
          <p>Try another search or clear the active category.</p>
          <button className="button button-light" type="button" onClick={resetFilters}>
            Show all services
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
