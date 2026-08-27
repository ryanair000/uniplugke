"use client";

import Link from "next/link";
import { Check, Minus, Plus, ShieldCheck, ShoppingBag, ShoppingCart, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  STORE_CART_EVENT,
  addStoreCartProduct,
  clearStoreCart,
  getStoreCartSnapshot,
  removeStoreCartItem,
  updateStoreCartQuantity
} from "@/lib/store-cart";
import type { StoreCartItem } from "@/lib/store-cart";
import { StoreProductImage } from "@/components/store-product-image";
import { calculateStoreDeliveryFee, KENYAN_COUNTIES } from "@/lib/store-shipping";
import type { PhysicalCatalogProduct } from "@/lib/storefront-products";

const money = new Intl.NumberFormat("en-KE");

function subscribeToCart(callback: () => void) {
  window.addEventListener(STORE_CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORE_CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useStoreCart() {
  const snapshot = useSyncExternalStore(subscribeToCart, getStoreCartSnapshot, () => "[]");
  return useMemo(() => {
    try {
      const parsed = JSON.parse(snapshot);
      return Array.isArray(parsed) ? parsed as StoreCartItem[] : [];
    } catch {
      return [];
    }
  }, [snapshot]);
}

export function StoreCartIndicator() {
  const items = useStoreCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return (
    <Link aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`} className="key-cart-link" href="/cart">
      <ShoppingCart aria-hidden="true" />
      <span>{count}</span>
    </Link>
  );
}

export function StoreAddButton({ product, compact = false }: { product: PhysicalCatalogProduct; compact?: boolean }) {
  const [added, setAdded] = useState(false);
  return (
    <button
      aria-label={`Add ${product.name} to cart`}
      className={compact ? "commerce-quick-add" : "store-add-button"}
      onClick={() => {
        addStoreCartProduct(product);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1400);
      }}
      type="button"
    >
      {added ? <Check aria-hidden="true" /> : <ShoppingCart aria-hidden="true" />}
      <span>{added ? "Added" : "Add to cart"}</span>
    </button>
  );
}

export function StoreProductPurchase({ product }: { product: PhysicalCatalogProduct }) {
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showMobilePurchase, setShowMobilePurchase] = useState(false);

  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;
    const observer = new IntersectionObserver(([entry]) => setShowMobilePurchase(!entry.isIntersecting), { threshold: 0.2 });
    observer.observe(actions);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="store-product-purchase" ref={actionsRef}>
        <StoreAddButton product={product} />
        <Link className="store-secondary-button" href="/cart">View cart</Link>
      </div>
      <div className={`store-mobile-purchase${showMobilePurchase ? " is-visible" : ""}`} aria-label="Purchase controls">
        <div><span>{product.stockLabel}</span><strong>KSh {money.format(product.priceKes)}</strong></div>
        <StoreAddButton product={product} />
      </div>
    </>
  );
}

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  county: string;
  city: string;
  address: string;
  deliveryNotes: string;
};

const emptyDetails: CustomerDetails = {
  name: "",
  email: "",
  phone: "",
  county: "Nairobi",
  city: "Nairobi",
  address: "",
  deliveryNotes: ""
};

export function StoreCartPage() {
  const items = useStoreCart();
  const [details, setDetails] = useState(emptyDetails);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subtotal = items.reduce((total, item) => total + item.priceKes * item.quantity, 0);
  const deliveryFee = items.length ? calculateStoreDeliveryFee(subtotal, details.county, details.city) : 0;
  const total = subtotal + deliveryFee;

  function updateDetail(field: keyof CustomerDetails, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  async function checkout() {
    if (busy || !items.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...details,
          items: items.map((item) => ({ slug: item.slug, quantity: item.quantity }))
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) throw new Error(body.error || "Checkout could not start");
      window.location.assign(body.authorizationUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not start");
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <section className="store-empty-cart commerce-shell">
        <ShoppingBag aria-hidden="true" />
        <h1>Your cart is empty.</h1>
        <p>Browse the full physical catalog and add the products you need.</p>
        <Link className="commerce-button commerce-button-primary" href="/#popular">Browse products</Link>
      </section>
    );
  }

  const canCheckout = details.name.trim().length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())
    && details.phone.replace(/\D/g, "").length >= 9
    && details.county.trim().length >= 2
    && details.city.trim().length >= 2
    && details.address.trim().length >= 5;

  return (
    <section className="store-cart-page commerce-shell">
      <ol className="store-checkout-steps" aria-label="Checkout progress">
        <li className="is-complete"><span>1</span>Cart</li>
        <li className="is-current"><span>2</span>Delivery</li>
        <li><span>3</span>Payment</li>
      </ol>
      <div className="store-page-heading">
        <p className="commerce-eyebrow">Physical products</p>
        <h1>Your cart</h1>
        <p>Confirm your order and tell us where to deliver it.</p>
        <Link className="store-continue-shopping" href="/#popular">Continue shopping</Link>
      </div>
      <div className="store-cart-layout">
        <div className="store-cart-main">
          <div className="store-cart-items">
            {items.map((item) => (
              <article className="store-cart-item" key={item.slug}>
                <Link href={`/products/${item.slug}`}><StoreProductImage alt={item.name} loading="lazy" src={item.image} /></Link>
                <div className="store-cart-item-copy">
                  <span>{item.categoryLabel}</span>
                  <h2><Link href={`/products/${item.slug}`}>{item.name}</Link></h2>
                  <strong>KSh {money.format(item.priceKes)}</strong>
                </div>
                <div className="store-cart-item-actions">
                  <div className="store-quantity" aria-label={`Quantity for ${item.name}`}>
                    <button aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => updateStoreCartQuantity(item.slug, item.quantity - 1)} type="button"><Minus aria-hidden="true" /></button>
                    <span>{item.quantity}</span>
                    <button aria-label="Increase quantity" disabled={item.quantity >= Math.min(item.stockQuantity || 10, 10)} onClick={() => updateStoreCartQuantity(item.slug, item.quantity + 1)} type="button"><Plus aria-hidden="true" /></button>
                  </div>
                  <button aria-label={`Remove ${item.name}`} className="store-remove" onClick={() => removeStoreCartItem(item.slug)} type="button"><Trash2 aria-hidden="true" /></button>
                </div>
              </article>
            ))}
          </div>

          <form className="store-delivery-form" onSubmit={(event) => { event.preventDefault(); void checkout(); }}>
            <div className="store-form-heading"><Truck aria-hidden="true" /><span><strong>Delivery details</strong><small>For physical fulfillment and order updates</small></span></div>
            <div className="store-form-grid">
              <label>Full name<input autoComplete="name" onChange={(event) => updateDetail("name", event.target.value)} required value={details.name} /></label>
              <label>Email<input autoComplete="email" onChange={(event) => updateDetail("email", event.target.value)} required type="email" value={details.email} /></label>
              <label>Phone / WhatsApp<input autoComplete="tel" inputMode="tel" onChange={(event) => updateDetail("phone", event.target.value)} placeholder="07..." required value={details.phone} /></label>
              <label>County<select autoComplete="address-level1" onChange={(event) => updateDetail("county", event.target.value)} required value={details.county}>{KENYAN_COUNTIES.map((county) => <option key={county} value={county}>{county}</option>)}</select></label>
              <label>Town / city<input autoComplete="address-level2" onChange={(event) => updateDetail("city", event.target.value)} required value={details.city} /></label>
              <label className="store-form-wide">Delivery address<input autoComplete="street-address" onChange={(event) => updateDetail("address", event.target.value)} placeholder="Building, street or pickup point" required value={details.address} /></label>
              <label className="store-form-wide">Delivery notes <span>(optional)</span><textarea maxLength={500} onChange={(event) => updateDetail("deliveryNotes", event.target.value)} value={details.deliveryNotes} /></label>
            </div>
            <button className="sr-only" type="submit">Continue to Paystack</button>
          </form>
        </div>

        <aside className="store-order-summary">
          <h2>Order summary</h2>
          <div><span>Subtotal</span><strong>KSh {money.format(subtotal)}</strong></div>
          <div><span>Delivery</span><strong>{deliveryFee ? `KSh ${money.format(deliveryFee)}` : "Free"}</strong></div>
          <div className="store-order-total"><span>Total</span><strong>KSh {money.format(total)}</strong></div>
          <div className="store-delivery-policy"><Truck aria-hidden="true" /><span>Free Nairobi delivery on orders of KSh 10,000+. Nationwide delivery is KSh 500.</span></div>
          <p><ShieldCheck aria-hidden="true" /> Price, stock and delivery are confirmed before payment.</p>
          {error ? <p className="store-checkout-error" role="alert">{error}</p> : null}
          <button className="commerce-button commerce-button-accent" disabled={!canCheckout || busy} onClick={() => void checkout()} type="button">
            {busy ? "Opening Paystack..." : "Continue to Paystack"}
          </button>
          <small>Paystack accepts M-Pesa and cards.</small>
        </aside>
      </div>
    </section>
  );
}

export { clearStoreCart };
