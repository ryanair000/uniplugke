import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyProductDetail } from "@/components/key-product-detail";
import { KEY_PRODUCTS, getKeyProduct } from "@/lib/key-products";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(KEY_PRODUCTS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getKeyProduct((await params).slug);
  if (!product) return { title: "Software key not found" };

  return {
    title: `${product.name} software key`,
    description: `${product.name} for KSh ${product.priceKes.toLocaleString("en-KE")} for ${product.termLabel}, with digital delivery and activation support. Review licence terms before payment.`,
    alternates: { canonical: `/keys/${product.slug}` },
    openGraph: {
      title: `${product.name} software key | UniPlug`,
      description: `KSh ${product.priceKes.toLocaleString("en-KE")} for ${product.termLabel}. Review confirmed and pending licence terms before payment.`,
      url: `/keys/${product.slug}`,
      images: [product.image]
    }
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = getKeyProduct((await params).slug);
  if (!product) notFound();
  return <KeyProductDetail product={product} />;
}
