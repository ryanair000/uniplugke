"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { ServiceArtwork } from "@/components/service-artwork";
import type { CartItem, CatalogService, MemberPlan } from "@/lib/types";

const categoryLabels: Record<string, string> = {
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

const homepageCategories = [
  ["all", "All services"],
  ["streaming", "Watch"],
  ["music", "Listen"],
  ["creative", "Create"],
  ["productivity", "Work"],
  ["cloud", "Store & cloud"],
  ["gaming", "Play"]
] as const;

const homepageCategoryLabels: Record<string, string> = {
  streaming: "Watch",
  music: "Listen",
  creative: "Create",
  productivity: "Work",
  cloud: "Store & cloud",
  gaming: "Play",
  ai: "Create",
  security: "Work",
  learning: "Work"
};

const homepageServiceOrder = [
  "netflix-premium",
  "spotify-premium",
  "canva-pro",
  "microsoft-365",
  "game-pass-ultimate",
  "icloud-plus-200"
];

const homepageDescriptions: Record<string, string> = {
  "netflix-premium": "Unlimited movies, TV shows and Netflix originals.",
  "spotify-premium": "Ad-free music listening, offline downloads, on demand.",
  "canva-pro": "Design anything. Unlock premium templates and tools.",
  "microsoft-365": "Premium Office apps, 1TB cloud storage, and more.",
  "game-pass-ultimate": "Hundreds of games, EA Play, Xbox Live Gold and more.",
  "icloud-plus-200": "Private cloud storage for your photos, files and backups."
};

const homepageDevices: Record<string, string[]> = {
  "netflix-premium": ["Smart TV", "Phone", "Tablet", "Web"],
  "spotify-premium": ["Phone", "Tablet", "Desktop", "Web"],
  "canva-pro": ["Web", "Desktop", "Mobile", "Tablet"],
  "microsoft-365": ["PC", "Mac", "Tablet", "Phone"],
  "game-pass-ultimate": ["Console", "PC", "Cloud", "Mobile"],
  "icloud-plus-200": ["iPhone", "iPad", "Mac", "Web"]
};

function homeDeviceLabel(device: string) {
  const labels: Record<string, string> = {
    Browser: "Web",
    Mobile: "Phone",
    Xbox: "Console",
    Windows: "PC",
    "Windows PC": "PC",
    "Supported mobile devices": "Mobile"
  };
  return labels[device] ?? device;
}

function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

type CartContextValue = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (planId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("uniplug-member-cart") || "[]");
    return Array.isArray(stored) ? stored as CartItem[] : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (enabled) {
        setItems(readStoredCart());
      } else {
        localStorage.removeItem("uniplug-member-cart");
        setItems([]);
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    if (hydrated && enabled) localStorage.setItem("uniplug-member-cart", JSON.stringify(items));
  }, [enabled, hydrated, items]);

  const add = useCallback((item: CartItem) => {
    if (!enabled) return;
    setItems((current) => current.some((entry) => entry.planId === item.planId) ? current : [...current, item]);
  }, [enabled]);
  const remove = useCallback((planId: string) => {
    setItems((current) => current.filter((item) => item.planId !== planId));
  }, []);
  const clear = useCallback(() => {
    localStorage.removeItem("uniplug-member-cart");
    setItems([]);
  }, []);
  const value = useMemo(() => ({ items, add, remove, clear }), [items, add, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider is missing");
  return value;
}

export function CartLink() {
  const { items } = useCart();
  return <Link className="cart-link" href="/checkout">Cart <span>{items.length}</span></Link>;
}

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
    plans.forEach((plan) => { if (!map.has(plan.serviceId)) map.set(plan.serviceId, plan); });
    return map;
  }, [plans]);

  const visible = useMemo(() => services.filter((service) => {
    const categoryMatch = category === "all" || service.category === category;
    const searchMatch = !search || `${service.name} ${service.shortDescription} ${service.features.join(" ")}`.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  }), [category, search, services]);

  if (variant === "homepage") {
    const orderedServices = [...visible]
      .sort((a, b) => {
        const aIndex = homepageServiceOrder.indexOf(a.slug);
        const bIndex = homepageServiceOrder.indexOf(b.slug);
        return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex)
          - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
      })
      .slice(0, 6);

    return (
      <section className="home-catalog" aria-labelledby="catalog-title">
        <div className="home-catalog-toolbar">
          <div>
            <h1 id="catalog-title">Explore digital services</h1>
            <p>Find what you need and manage it in one account.</p>
          </div>
          <form
            className="home-search"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="home-search-input">
              <span className="sr-only">Search services</span>
              <input
                type="search"
                placeholder="Search services"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Image src="/figma/search-icon.svg" alt="" width={20} height={20} />
            </label>
            <button type="submit">Search</button>
          </form>
        </div>

        <div className="home-catalog-body">
          <div className="home-category-block">
            <h2>Browse by category</h2>
            <div className="home-category-row" aria-label="Service categories">
              {homepageCategories.map(([key, label]) => (
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
          </div>

          <div className="home-popular-heading">
            <h2>Popular on UniPlug</h2>
            <p>
              {isMember
                ? "Your exact member prices are shown in Kenyan shillings."
                : "Starting prices are shown in USD. Sign in for exact Kenya pricing in KSh."}
            </p>
          </div>

          <div className="home-service-grid">
            {orderedServices.map((service) => {
              const plan = planByService.get(service.id);
              const availability = service.availabilityStatus === "limited"
                ? "Limited stock"
                : service.availabilityStatus === "coming_soon"
                  ? "Coming soon"
                  : "In stock";

              return (
                <article className="home-service-card" key={service.id}>
                  <div className="home-service-header">
                    <ServiceArtwork
                      accentColor={service.accentColor}
                      className="home-service-logo"
                      logoText={service.logoText}
                      name={service.name}
                      slug={service.slug}
                    />
                    <div className="home-service-identity">
                      <h3>{service.name}</h3>
                      <span className="home-category-tag">
                        {homepageCategoryLabels[service.category] ?? categoryLabels[service.category]}
                      </span>
                    </div>
                  </div>

                  <p className="home-service-description">
                    {homepageDescriptions[service.slug] ?? service.shortDescription}
                  </p>

                  <div className="home-device-row" aria-label={`Supported devices for ${service.name}`}>
                    {(homepageDevices[service.slug] ?? service.supportedDevices.slice(0, 4).map(homeDeviceLabel)).map((device) => (
                      <span key={device}>{device}</span>
                    ))}
                  </div>

                  <div className="home-service-footer">
                    <div className="home-service-meta">
                      <span className={`home-stock ${service.availabilityStatus}`}>
                        <span aria-hidden="true" />
                        {availability}
                      </span>
                      {isMember && plan ? (
                        <span className="home-card-price">
                          <strong>{formatKes(plan.priceKes)}</strong> / {plan.billingCycle}
                        </span>
                      ) : service.startingPriceUsd !== null ? (
                        <span className="home-card-price">
                          From <strong>{formatUsd(service.startingPriceUsd)}</strong> USD
                        </span>
                      ) : (
                        <span className="home-card-price">Sign in for pricing</span>
                      )}
                    </div>
                    <Link href={`/services/${service.slug}`}>
                      View service <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {!orderedServices.length && (
            <div className="home-empty-state">
              <h2>No services found</h2>
              <p>Try another search or category.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="catalog-tools">
        <div className="category-row" aria-label="Service categories">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button type="button" key={key} className={category === key ? "chip active" : "chip"} onClick={() => setCategory(key)}>{label}</button>
          ))}
        </div>
        <input aria-label="Search services" className="search-input" placeholder="Search services" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="service-grid">
        {visible.map((service) => {
          const plan = planByService.get(service.id);
          return (
            <article className="service-card" key={service.id}>
              <div className="service-card-top">
                <ServiceArtwork
                  accentColor={service.accentColor}
                  className="service-logo"
                  logoText={service.logoText}
                  name={service.name}
                  slug={service.slug}
                />
                <span className={`availability ${service.availabilityStatus}`}>{service.availabilityStatus.replace("_", " ")}</span>
              </div>
              <p className="eyebrow">{categoryLabels[service.category]}</p>
              <h3>{service.name}</h3>
              <p>{service.shortDescription}</p>
              <ul>{service.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <div className="service-card-footer">
                {isMember && plan ? (
                  <div><strong>{formatKes(plan.priceKes)}</strong><span> / {plan.billingCycle}</span></div>
                ) : service.startingPriceUsd !== null ? (
                  <div className="public-price"><strong>From {formatUsd(service.startingPriceUsd)}</strong><span> USD · exact KSh pricing after sign-in</span></div>
                ) : (
                  <div className="price-lock">Sign in to view current pricing</div>
                )}
                <Link className="round-link" href={`/services/${service.slug}`} aria-label={`View ${service.name}`}>→</Link>
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && <div className="empty-state">No services match your search.</div>}
    </div>
  );
}

export function PlanOptions({ plans, service }: { plans: MemberPlan[]; service: CatalogService }) {
  const { add, items } = useCart();
  if (!plans.length) return <div className="member-lock"><h3>Member pricing</h3><p>No active member plan is currently available for this service.</p></div>;

  return (
    <div className="plan-grid">
      {plans.map((plan) => {
        const added = items.some((item) => item.planId === plan.id);
        return (
          <div className="plan-card" key={plan.id}>
            <p className="eyebrow">{plan.billingCycle}</p>
            <h3>{plan.planName}</h3>
            <div className="plan-price">{formatKes(plan.priceKes)}{plan.compareAtKes ? <del>{formatKes(plan.compareAtKes)}</del> : null}</div>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <button
              type="button"
              className="button button-dark"
              disabled={added || plan.availabilityStatus === "unavailable"}
              onClick={() => add({ planId: plan.id, serviceSlug: service.slug, serviceName: service.name, planName: plan.planName, priceKes: plan.priceKes, billingCycle: plan.billingCycle })}
            >
              {added ? "Added to cart" : "Add to cart"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
