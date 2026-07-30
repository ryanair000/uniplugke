"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CatalogServiceCard, categoryLabels } from "@/components/service-card";
import type { CatalogService, MemberPlan } from "@/lib/types";

const featuredOrder = [
  "netflix-premium",
  "spotify-premium",
  "canva-pro",
  "microsoft-365",
  "game-pass-ultimate",
  "icloud-plus-200"
];

export function CatalogExplorer({
  services,
  plans,
  isMember,
  variant = "default"
}: {
  services: CatalogService[];
  plans: MemberPlan[];
  isMember: boolean;
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

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return services.filter((service) => {
      const categoryMatch = category === "all" || service.category === category;
      const searchableText = [
        service.name,
        service.shortDescription,
        service.category,
        ...service.features,
        ...service.supportedDevices
      ].join(" ").toLowerCase();
      return categoryMatch && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [category, search, services]);

  const featuredServices = useMemo(() => [...services]
    .sort((a, b) => {
      const aIndex = featuredOrder.indexOf(a.slug);
      const bIndex = featuredOrder.indexOf(b.slug);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex)
        - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    })
    .slice(0, 6), [services]);

  if (variant === "homepage") {
    return (
      <section className="featured-catalog" aria-labelledby="featured-services-title">
        <div className="upgrade-shell">
          <div className="catalog-section-heading">
            <div>
              <p className="upgrade-eyebrow">Popular services</p>
              <h2 id="featured-services-title">Start with what you use most.</h2>
              <p>
              {isMember
                  ? "Every member price is shown in KSh and with an approximate USD equivalent."
                  : "This catalog is available only to invited clients."}
              </p>
            </div>
            <Link className="text-link" href="/services">
              View all services <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="catalog-card-grid">
            {featuredServices.map((service) => (
              <CatalogServiceCard
                isMember={isMember}
                key={service.id}
                plan={planByService.get(service.id)}
                service={service}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const hasFilters = category !== "all" || search.trim().length > 0;

  function resetFilters() {
    setCategory("all");
    setSearch("");
  }

  return (
    <div className="catalog-explorer">
      <div className="catalog-search-row">
        <label className="catalog-search">
          <span>Search the catalog</span>
          <input
            type="search"
            placeholder="Try Netflix, music, cloud…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="catalog-result-count" aria-live="polite">
          {visible.length} service{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="catalog-filter-row">
        <div className="catalog-category-row" aria-label="Service categories">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={category === key ? "active" : ""}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {hasFilters ? (
          <button className="catalog-clear" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="catalog-card-grid">
        {visible.map((service) => (
          <CatalogServiceCard
            isMember={isMember}
            key={service.id}
            plan={planByService.get(service.id)}
            service={service}
          />
        ))}
      </div>

      {!visible.length ? (
        <div className="catalog-empty">
          <h2>No matching services</h2>
          <p>Try a broader search or reset the active filters.</p>
          <button className="button button-light" type="button" onClick={resetFilters}>
            Reset catalog
          </button>
        </div>
      ) : null}
    </div>
  );
}
