"use client";

import type { PhysicalCatalogProduct } from "@/lib/storefront-products";

export const STORE_CART_KEY = "uniplug-physical-cart-v1";
export const STORE_CART_EVENT = "uniplug-store-cart-change";

export type StoreCartItem = {
  slug: string;
  name: string;
  priceKes: number;
  image: string;
  categoryLabel: string;
  stockQuantity: number | null;
  quantity: number;
};

function sanitizeCart(value: unknown): StoreCartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<StoreCartItem>;
    const slug = String(item.slug || "");
    const quantity = Math.max(1, Math.min(10, Math.floor(Number(item.quantity) || 1)));
    if (!/^[a-z0-9-]{2,180}$/.test(slug) || !item.name || !Number.isFinite(Number(item.priceKes))) return [];
    return [{
      slug,
      name: String(item.name).slice(0, 240),
      priceKes: Number(item.priceKes),
      image: String(item.image || "/storefront/product-placeholder.svg"),
      categoryLabel: String(item.categoryLabel || "Physical product"),
      stockQuantity: item.stockQuantity === null ? null : Math.max(0, Number(item.stockQuantity) || 0),
      quantity
    }];
  }).slice(0, 20);
}

export function readStoreCart(): StoreCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeCart(JSON.parse(window.localStorage.getItem(STORE_CART_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function getStoreCartSnapshot() {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(STORE_CART_KEY) || "[]";
}

function writeStoreCart(items: StoreCartItem[]) {
  window.localStorage.setItem(STORE_CART_KEY, JSON.stringify(sanitizeCart(items)));
  window.dispatchEvent(new Event(STORE_CART_EVENT));
}

export function addStoreCartProduct(product: PhysicalCatalogProduct, quantity = 1) {
  const items = readStoreCart();
  const existing = items.find((item) => item.slug === product.slug);
  if (existing) {
    existing.quantity = Math.min(existing.stockQuantity || 10, existing.quantity + quantity, 10);
  } else {
    items.push({
      slug: product.slug,
      name: product.name,
      priceKes: product.priceKes,
      image: product.image,
      categoryLabel: product.categoryLabel,
      stockQuantity: product.stockQuantity,
      quantity: Math.max(1, Math.min(product.stockQuantity || 10, quantity, 10))
    });
  }
  writeStoreCart(items);
}

export function updateStoreCartQuantity(slug: string, quantity: number) {
  const items = readStoreCart();
  const item = items.find((candidate) => candidate.slug === slug);
  if (!item) return;
  item.quantity = Math.max(1, Math.min(item.stockQuantity || 10, Math.floor(quantity), 10));
  writeStoreCart(items);
}

export function removeStoreCartItem(slug: string) {
  writeStoreCart(readStoreCart().filter((item) => item.slug !== slug));
}

export function clearStoreCart() {
  if (typeof window === "undefined") return;
  writeStoreCart([]);
}
