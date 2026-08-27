import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { KEY_PRODUCTS } from "@/lib/key-products";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StorefrontCategory =
  | "software"
  | "games"
  | "gaming"
  | "audio"
  | "power"
  | "peripherals"
  | "storage"
  | "accessories";

export type StorefrontProductSource = "key" | "uniplug_products" | "catalog";

export type StorefrontProduct = {
  id: string;
  sourceId: string;
  source: StorefrontProductSource;
  slug: string;
  name: string;
  brand: string;
  category: StorefrontCategory;
  categoryLabel: string;
  fulfillment: "digital" | "physical";
  priceKes: number;
  image: string;
  images: string[];
  imageAlt: string;
  href: string;
  external: boolean;
  stockLabel: string;
  stockQuantity: number | null;
  description: string;
  platform: string | null;
  featured: boolean;
};

export type PhysicalCatalogProduct = StorefrontProduct & { fulfillment: "physical" };

type PhysicalProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  brand: string | null;
  type: string;
  price_kes: number;
  cover_image: string | null;
  images: string[] | null;
  stock_quantity: number | null;
  in_stock: boolean;
  platform: string | null;
  featured: boolean | null;
  sort_order: number | null;
};

type AccessoryRow = {
  id: string;
  name: string;
  slug: string;
  platform: string | null;
  genre: string | null;
  selling_price: number;
  image_url: string | null;
  stock_quantity: number | null;
  unlimited_stock: boolean | null;
  description: string | null;
  is_featured: boolean | null;
};

export const PHYSICAL_PRODUCT_TYPES = ["physical_accessory", "disk_game", "physical_code_in_box"] as const;

const physicalSelect = "id,name,slug,description,category,subcategory,brand,type,price_kes,cover_image,images,stock_quantity,in_stock,platform,featured,sort_order";
const accessorySelect = "id,name,slug,platform,genre,selling_price,image_url,stock_quantity,unlimited_stock,description,is_featured";

const fallbackPhysicalProducts: PhysicalCatalogProduct[] = [
  {
    id: "physical-logitech-mx-master-3s",
    sourceId: "physical-logitech-mx-master-3s",
    source: "uniplug_products",
    slug: "logitech-mx-master-3s-wireless-mouse",
    name: "Logitech MX Master 3S Wireless Mouse",
    brand: "Logitech",
    category: "peripherals",
    categoryLabel: "Peripherals",
    fulfillment: "physical",
    priceKes: 10000,
    image: "https://yzrphxigmqmgkgqfmofd.supabase.co/storage/v1/object/public/product-images/peripherals/logitech-mx-master-3s-wireless-mouse.jpg",
    images: [],
    imageAlt: "Logitech MX Master 3S wireless mouse",
    href: "/products/logitech-mx-master-3s-wireless-mouse",
    external: false,
    stockLabel: "In stock",
    stockQuantity: 10,
    description: "A quiet, precise wireless mouse made for productive desk setups.",
    platform: null,
    featured: true
  },
  {
    id: "physical-logitech-c920",
    sourceId: "physical-logitech-c920",
    source: "uniplug_products",
    slug: "logitech-c920-hd-pro-webcam",
    name: "Logitech C920 HD Pro Webcam",
    brand: "Logitech",
    category: "peripherals",
    categoryLabel: "Peripherals",
    fulfillment: "physical",
    priceKes: 8000,
    image: "https://yzrphxigmqmgkgqfmofd.supabase.co/storage/v1/object/public/product-images/physical_products/logitech-c920-webcam.jpg",
    images: [],
    imageAlt: "Logitech C920 HD Pro webcam",
    href: "/products/logitech-c920-hd-pro-webcam",
    external: false,
    stockLabel: "In stock",
    stockQuantity: 10,
    description: "Full HD webcam for video calls, streaming and hybrid work.",
    platform: null,
    featured: false
  }
];

function digitalProducts(): StorefrontProduct[] {
  return Object.values(KEY_PRODUCTS).map((product) => ({
    id: `key-${product.slug}`,
    sourceId: product.slug,
    source: "key",
    slug: product.slug,
    name: product.name,
    brand: product.slug === "windows-11-pro" ? "Microsoft" : "Adobe",
    category: "software",
    categoryLabel: product.categoryLabel,
    fulfillment: "digital",
    priceKes: product.priceKes,
    image: product.image,
    images: [],
    imageAlt: product.imageAlt,
    href: `/keys/${product.slug}`,
    external: false,
    stockLabel: "Available",
    stockQuantity: null,
    description: product.description,
    platform: null,
    featured: true
  }));
}

function categoryForPhysical(row: Pick<PhysicalProductRow, "category" | "type">): StorefrontCategory {
  if (row.type === "disk_game" || row.type === "physical_code_in_box" || row.category === "disk-games") return "games";
  if (["earbuds", "headphones", "speakers"].includes(row.category)) return "audio";
  if (["power-banks", "chargers-cables"].includes(row.category)) return "power";
  if (row.category === "peripherals") return "peripherals";
  if (row.category === "gaming") return "gaming";
  return "accessories";
}

function categoryForAccessory(genre: string | null): StorefrontCategory {
  const normalized = (genre || "").toLowerCase();
  if (normalized.includes("storage")) return "storage";
  if (normalized.includes("headset") || normalized.includes("audio")) return "audio";
  if (normalized.includes("charging")) return "power";
  if (["controllers", "consoles", "steering wheels", "vr"].some((value) => normalized.includes(value))) return "gaming";
  return "accessories";
}

export function storefrontCategoryLabel(category: StorefrontCategory) {
  const labels: Record<StorefrontCategory, string> = {
    software: "Software",
    games: "Physical games",
    gaming: "Gaming",
    audio: "Audio",
    power: "Power & charging",
    peripherals: "Peripherals",
    storage: "Storage",
    accessories: "Accessories"
  };
  return labels[category];
}

function stockLabel(quantity: number | null, unlimited = false) {
  if (unlimited) return "In stock";
  if (quantity !== null && quantity <= 3) return `Only ${quantity} left`;
  return "In stock";
}

function formatCategoryLabel(value: string) {
  const preferredCase: Record<string, string> = {
    pc: "PC",
    ps4: "PS4",
    ps5: "PS5",
    ssd: "SSD",
    usb: "USB",
    vr: "VR",
    xbox: "Xbox"
  };
  return value
    .replaceAll("-", " ")
    .split(/\s+/)
    .map((word) => preferredCase[word.toLowerCase()] || `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function mapPhysicalProduct(row: PhysicalProductRow): PhysicalCatalogProduct {
  const category = categoryForPhysical(row);
  return {
    id: `physical-${row.id}`,
    sourceId: row.id,
    source: "uniplug_products",
    slug: row.slug,
    name: row.name,
    brand: row.brand || "UniPlug",
    category,
    categoryLabel: row.subcategory ? formatCategoryLabel(row.subcategory) : storefrontCategoryLabel(category),
    fulfillment: "physical",
    priceKes: Number(row.price_kes),
    image: row.cover_image || "/storefront/product-placeholder.svg",
    images: (row.images || []).filter((image): image is string => typeof image === "string" && image.startsWith("https://")),
    imageAlt: row.name,
    href: `/products/${row.slug}`,
    external: false,
    stockLabel: stockLabel(row.stock_quantity),
    stockQuantity: row.stock_quantity,
    description: row.description || `${row.name} supplied through UniPlug with local support and delivery across Kenya.`,
    platform: row.platform,
    featured: Boolean(row.featured)
  };
}

function mapAccessory(row: AccessoryRow): PhysicalCatalogProduct {
  const category = categoryForAccessory(row.genre);
  return {
    id: `accessory-${row.id}`,
    sourceId: row.id,
    source: "catalog",
    slug: row.slug,
    name: row.name,
    brand: row.platform || "UniPlug",
    category,
    categoryLabel: row.genre ? formatCategoryLabel(row.genre) : storefrontCategoryLabel(category),
    fulfillment: "physical",
    priceKes: Number(row.selling_price),
    image: row.image_url || "/storefront/product-placeholder.svg",
    images: [],
    imageAlt: row.name,
    href: `/products/${row.slug}`,
    external: false,
    stockLabel: stockLabel(row.stock_quantity, Boolean(row.unlimited_stock)),
    stockQuantity: row.unlimited_stock ? null : row.stock_quantity,
    description: row.description || `${row.name}, sold in KSh with delivery across Kenya and order support from UniPlug.`,
    platform: row.platform,
    featured: Boolean(row.is_featured)
  };
}

function merchandiseProducts(products: StorefrontProduct[]) {
  const digital = products.filter((product) => product.fulfillment === "digital");
  const physical = products.filter((product) => product.fulfillment === "physical");
  const categoryOrder: StorefrontCategory[] = [
    "peripherals",
    "gaming",
    "audio",
    "power",
    "games",
    "storage",
    "accessories"
  ];
  const queues = new Map(categoryOrder.map((category) => [
    category,
    physical
      .filter((product) => product.category === category)
      .map((product, index) => ({
        product,
        index,
        ownedMedia: product.image.startsWith("/") || product.image.includes("supabase.co/storage/v1/object/public/product-images/")
      }))
      .sort((left, right) => Number(right.ownedMedia) - Number(left.ownedMedia) || left.index - right.index)
      .map(({ product }) => product)
  ]));
  const mixed: StorefrontProduct[] = [];

  while (mixed.length < physical.length) {
    let added = false;
    for (const category of categoryOrder) {
      const next = queues.get(category)?.shift();
      if (next) {
        mixed.push(next);
        added = true;
      }
    }
    if (!added) break;
  }

  return [...digital, ...mixed];
}

async function fetchAllPhysicalRows(supabase: SupabaseClient) {
  const rows: PhysicalProductRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase
      .from("uniplug_products")
      .select(physicalSelect)
      .in("type", [...PHYSICAL_PRODUCT_TYPES])
      .eq("in_stock", true)
      .gt("price_kes", 0)
      .order("featured", { ascending: false })
      .order("sort_order")
      .order("name")
      .range(offset, offset + 999);
    if (result.error) throw result.error;
    const page = (result.data || []) as unknown as PhysicalProductRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function fetchAllAccessoryRows(supabase: SupabaseClient) {
  const rows: AccessoryRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase
      .from("catalog")
      .select(accessorySelect)
      .eq("category", "accessories")
      .gt("selling_price", 0)
      .is("deleted_at", null)
      .order("is_featured", { ascending: false })
      .order("name")
      .range(offset, offset + 999);
    if (result.error) throw result.error;
    const page = (result.data || []) as unknown as AccessoryRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function getStorefrontProducts(): Promise<StorefrontProduct[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [...digitalProducts(), ...fallbackPhysicalProducts];

  try {
    const [physicalRows, accessoryRows] = await Promise.all([
      fetchAllPhysicalRows(supabase),
      fetchAllAccessoryRows(supabase)
    ]);
    const physical = physicalRows.map(mapPhysicalProduct);
    const existingSlugs = new Set(physical.map((product) => product.slug));
    const additionalAccessories = accessoryRows
      .filter((row) => !existingSlugs.has(row.slug))
      .map(mapAccessory);
    return merchandiseProducts([...digitalProducts(), ...physical, ...additionalAccessories]);
  } catch (error) {
    console.error("Storefront catalog query failed", error instanceof Error ? error.message : "Unknown catalog error");
    return [...digitalProducts(), ...fallbackPhysicalProducts];
  }
}

export async function getPhysicalProductBySlug(slug: string): Promise<PhysicalCatalogProduct | null> {
  if (!/^[a-z0-9-]{2,180}$/.test(slug)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return fallbackPhysicalProducts.find((product) => product.slug === slug) || null;

  const physicalResult = await supabase
    .from("uniplug_products")
    .select(physicalSelect)
    .eq("slug", slug)
    .in("type", [...PHYSICAL_PRODUCT_TYPES])
    .eq("in_stock", true)
    .gt("price_kes", 0)
    .maybeSingle();
  if (physicalResult.data) return mapPhysicalProduct(physicalResult.data as unknown as PhysicalProductRow);

  const accessoryResult = await supabase
    .from("catalog")
    .select(accessorySelect)
    .eq("slug", slug)
    .eq("category", "accessories")
    .gt("selling_price", 0)
    .is("deleted_at", null)
    .maybeSingle();
  if (accessoryResult.data) return mapAccessory(accessoryResult.data as unknown as AccessoryRow);
  return null;
}
