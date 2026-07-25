import { CheckoutClient } from "@/components/checkout";
import { requireMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const viewer = await requireMember();
  return <section className="section shell page-top"><CheckoutClient email={viewer.profile.email} /></section>;
}
