"use client";

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

function formatKes(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

type CartContextValue = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (planId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("uniplug-member-cart") || "[]");
      setItems(Array.isArray(stored) ? stored : []);
    } catch {
      setItems([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("uniplug-member-cart", JSON.stringify(items));
  }, [hydrated, items]);

  const add = useCallback((item: CartItem) => {
    setItems((current) => current.some((entry) => entry.planId === item.planId) ? current : [...current, item]);
  }, []);
  const remove = useCallback((planId: string) => {
    setItems((current) => current.filter((item) => item.planId !== planId));
  }, []);
  const clear = useCallback(() => setItems([]), []);
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
  isMember
}: {
  services: CatalogService[];
  plans: MemberPlan[];
  isMember: boolean;
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
                <div className="service-logo" style={{ background: service.accentColor }}>{service.logoText}</div>
                <span className={`availability ${service.availabilityStatus}`}>{service.availabilityStatus.replace("_", " ")}</span>
              </div>
              <p className="eyebrow">{categoryLabels[service.category]}</p>
              <h3>{service.name}</h3>
              <p>{service.shortDescription}</p>
              <ul>{service.features.slice(0, 3).map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <div className="service-card-footer">
                {isMember && plan ? (
                  <div><strong>{formatKes(plan.priceKes)}</strong><span> / {plan.billingCycle}</span></div>
                ) : (
                  <div className="price-lock">Sign in to view member pricing</div>
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
