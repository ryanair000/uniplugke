import { CheckoutClient } from "@/components/checkout";
import { requireMember } from "@/lib/auth";
import { KeyCheckout } from "@/components/key-store";
import { getKeyProduct, type KeyProductSlug } from "@/lib/key-products";
import { isKeysStoreRequest } from "@/lib/site-mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  if (await isKeysStoreRequest()) {
    const product = getKeyProduct((await searchParams).product);
    return <KeyCheckout initialProduct={(product?.slug || "adobe-acrobat") as KeyProductSlug} />;
  }
  const viewer = await requireMember();
  return <section className="section shell page-top"><CheckoutClient email={viewer.profile.email} /></section>;
}
