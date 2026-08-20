import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhysicalProductDetail } from "@/components/physical-product-detail";
import { getPhysicalProductBySlug, getStorefrontProducts, type PhysicalCatalogProduct } from "@/lib/storefront-products";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getPhysicalProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: { title: product.name, description: product.description.slice(0, 160), images: [product.image] }
  };
}

export default async function PhysicalProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getPhysicalProductBySlug((await params).slug);
  if (!product) notFound();
  const products = await getStorefrontProducts();
  const related = products
    .filter((candidate): candidate is PhysicalCatalogProduct => candidate.fulfillment === "physical" && candidate.category === product.category && candidate.slug !== product.slug)
    .slice(0, 4);
  return <PhysicalProductDetail product={product} related={related} />;
}
