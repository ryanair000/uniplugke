"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AudioLines,
  BatteryCharging,
  Boxes,
  Cable,
  Disc3,
  Gamepad2,
  HardDrive,
  LayoutGrid,
  MonitorCheck,
  PackageCheck,
  ShieldCheck,
  Search,
  Smartphone,
  Truck,
  WalletCards,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StoreAddButton } from "@/components/store-cart";
import { StoreProductImage } from "@/components/store-product-image";
import type { PhysicalCatalogProduct, StorefrontCategory, StorefrontProduct } from "@/lib/storefront-products";

const money = new Intl.NumberFormat("en-KE");
const PAGE_SIZE = 24;

const categories: Array<{
  id: StorefrontCategory;
  label: string;
  icon: typeof Boxes;
}> = [
  { id: "software", label: "Software", icon: Boxes },
  { id: "games", label: "Physical games", icon: Disc3 },
  { id: "gaming", label: "Gaming gear", icon: Gamepad2 },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "power", label: "Power", icon: BatteryCharging },
  { id: "peripherals", label: "Peripherals", icon: Cable },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "accessories", label: "Accessories", icon: PackageCheck }
];

function StorefrontProductCard({ product, priority }: { product: StorefrontProduct; priority: boolean }) {
  return (
    <article className="commerce-product-card">
      <Link aria-label={`View ${product.name}`} className="commerce-product-image" href={product.href}>
        <StoreProductImage
          alt={product.imageAlt}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          src={product.image}
        />
      </Link>
      <div className="commerce-product-body">
        <div className="commerce-product-meta">
          <span className={`commerce-fulfillment commerce-fulfillment-${product.fulfillment}`}>
            {product.fulfillment}
          </span>
          <span>{product.brand}</span>
        </div>
        <h3><Link href={product.href}>{product.name}</Link></h3>
        <p className="commerce-product-category">{product.categoryLabel}</p>
        <div className="commerce-product-purchase">
          <strong>KSh {money.format(product.priceKes)}</strong>
          <span><i aria-hidden="true" />{product.stockLabel}</span>
        </div>
        {product.fulfillment === "physical" ? (
          <StoreAddButton compact product={product as PhysicalCatalogProduct} />
        ) : (
          <Link className="commerce-review-link" href={product.href}>Review licence</Link>
        )}
      </div>
    </article>
  );
}

export function StorefrontHome({
  categoryCounts,
  initialProducts,
  initialTotal
}: {
  categoryCounts: Record<StorefrontCategory, number>;
  initialProducts: StorefrontProduct[];
  initialTotal: number;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [category, setCategory] = useState<"all" | StorefrontCategory>("all");
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);

  const loadProducts = useCallback(async (
    nextCategory: "all" | StorefrontCategory,
    nextQuery: string,
    offset = 0,
    append = false
  ) => {
    setLoading(true);
    setCatalogError(false);
    try {
      const parameters = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
      if (nextCategory !== "all") parameters.set("category", nextCategory);
      if (nextQuery.trim()) parameters.set("q", nextQuery.trim());
      const response = await fetch(`/api/store/products?${parameters}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { products?: StorefrontProduct[]; total?: number };
      if (!response.ok || !Array.isArray(body.products)) throw new Error("Catalog request failed");
      setProducts((current) => append ? [...current, ...body.products!] : body.products!);
      setTotal(Number(body.total) || 0);
    } catch {
      setCatalogError(true);
      if (!append) {
        setProducts([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const requestedQuery = parameters.get("q")?.trim() || "";
    const requestedCategory = parameters.get("category") as StorefrontCategory | null;
    const timer = window.setTimeout(() => {
      setQuery(requestedQuery);
      setActiveQuery(requestedQuery);
      if (requestedCategory && categories.some((item) => item.id === requestedCategory)) {
        setCategory(requestedCategory);
        void loadProducts(requestedCategory, requestedQuery);
      } else if (requestedQuery) {
        void loadProducts("all", requestedQuery);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const selectCategory = (nextCategory: "all" | StorefrontCategory) => {
    setCategory(nextCategory);
    void loadProducts(nextCategory, activeQuery);
    const parameters = new URLSearchParams(window.location.search);
    if (nextCategory === "all") parameters.delete("category");
    else parameters.set("category", nextCategory);
    window.history.replaceState(null, "", `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}#popular`);
    document.getElementById("popular")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const searchProducts = () => {
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
    void loadProducts(category, nextQuery);
    const parameters = new URLSearchParams(window.location.search);
    if (nextQuery) parameters.set("q", nextQuery);
    else parameters.delete("q");
    window.history.replaceState(null, "", `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}#popular`);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveQuery("");
    void loadProducts(category, "");
    const parameters = new URLSearchParams(window.location.search);
    parameters.delete("q");
    window.history.replaceState(null, "", `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}#popular`);
  };

  return (
    <div className="commerce-home">
      <section className="commerce-hero">
        <div className="commerce-shell commerce-hero-layout">
          <div className="commerce-hero-copy">
            <p className="commerce-eyebrow">Tech for work, study and play</p>
            <h1>Everything your setup needs.</h1>
            <p>Software, gaming, audio and everyday tech with secure local payment, nationwide delivery and support.</p>
            <div className="commerce-hero-actions">
              <a className="commerce-button commerce-button-primary" href="#popular">Shop all products</a>
              <button className="commerce-button commerce-button-accent" onClick={() => selectCategory("software")} type="button">Explore software</button>
            </div>
            <div className="commerce-hero-proof" aria-label="Store benefits">
              <span><ShieldCheck aria-hidden="true" /> Genuine products</span>
              <span><WalletCards aria-hidden="true" /> M-Pesa ready</span>
            </div>
          </div>
          <div className="commerce-hero-visual" aria-label="Laptop, monitor and technology accessories">
            <Image
              alt="Laptop, monitor, keyboard, mouse, portable drive, controller and software package"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 58vw"
              src="/storefront/hero-tech-setup-v2.png"
            />
          </div>
        </div>
      </section>

      <nav className="commerce-category-band" aria-label="Shop categories">
        <div className="commerce-shell commerce-category-list">
          <button aria-pressed={category === "all"} onClick={() => selectCategory("all")} type="button">
            <LayoutGrid aria-hidden="true" />
            <span><b>All products</b><small>{money.format(initialTotal)}</small></span>
          </button>
          {categories.map((item) => {
            const Icon = item.icon;
            return (
              <button aria-pressed={category === item.id} key={item.id} onClick={() => selectCategory(item.id)} type="button">
                <Icon aria-hidden="true" />
                <span><b>{item.label}</b><small>{money.format(categoryCounts[item.id])}</small></span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="commerce-products commerce-shell" id="popular" aria-labelledby="popular-title">
        <div className="commerce-section-heading">
          <div>
            <p className="commerce-eyebrow">Shop the full catalog</p>
            <h2 id="popular-title">{category === "all" ? "All products" : categories.find((item) => item.id === category)?.label}</h2>
            <span className="commerce-result-count">Showing {products.length} of {money.format(total)} products</span>
          </div>
          <form className="commerce-inline-search" onSubmit={(event) => { event.preventDefault(); searchProducts(); }} role="search">
            <label htmlFor="commerce-search">Search products</label>
            <div>
              <Search aria-hidden="true" />
              <input
                id="commerce-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this selection"
                type="search"
                value={query}
              />
              {query ? <button aria-label="Clear search" className="commerce-search-clear" onClick={clearSearch} type="button"><X aria-hidden="true" /></button> : null}
              <button aria-label="Search products" className="commerce-search-submit" type="submit"><Search aria-hidden="true" /></button>
            </div>
          </form>
        </div>

        {activeQuery ? <div className="commerce-search-status" aria-live="polite">Results for <strong>“{activeQuery}”</strong></div> : null}

        {products.length ? (
          <>
            <div className={`commerce-product-grid${loading ? " is-loading" : ""}`} aria-busy={loading}>
              {products.map((product, index) => <StorefrontProductCard key={product.id} priority={index < 4} product={product} />)}
            </div>
            {products.length < total ? (
              <div className="commerce-load-more">
                <button className="commerce-button commerce-button-primary" disabled={loading} onClick={() => void loadProducts(category, activeQuery, products.length, true)} type="button">
                  {loading ? "Loading products..." : "Show more products"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="commerce-empty-state">
            <MonitorCheck aria-hidden="true" />
            <h3>No matching products found.</h3>
            <p>{catalogError ? "The catalog could not load. Please try again." : "Try another category or search term."}</p>
            <button className="commerce-button commerce-button-primary" onClick={() => { setCategory("all"); setQuery(""); setActiveQuery(""); void loadProducts("all", ""); }} type="button">{catalogError ? "Try again" : "Show all products"}</button>
          </div>
        )}
      </section>

      <section className="commerce-trust" aria-label="Why shop with UniPlug">
        <div className="commerce-shell commerce-trust-list">
          <div><ShieldCheck aria-hidden="true" /><span><strong>Genuine products</strong><small>Current catalog prices and stock</small></span></div>
          <div><Smartphone aria-hidden="true" /><span><strong>M-Pesa payments</strong><small>Secure local checkout</small></span></div>
          <div><Truck aria-hidden="true" /><span><strong>Nationwide delivery</strong><small>Physical products across Kenya</small></span></div>
          <div><PackageCheck aria-hidden="true" /><span><strong>Local support</strong><small>Help before and after purchase</small></span></div>
        </div>
      </section>
    </div>
  );
}
