import Link from "next/link";
import { notFound } from "next/navigation";
import { RenewalCheckout } from "@/components/renewal-checkout";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isPlanDurationMonths, planPriceForDuration } from "@/lib/plan-durations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Renew subscription" };

export default async function RenewalPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const { data: subscription } = await supabase
    .from("uniplug_member_subscriptions")
    .select("id,status,duration_months,service:uniplug_catalog_services(name),plan:uniplug_member_plans(plan_name,price_kes,billing_cycle,availability_status,duration_offers:uniplug_plan_duration_offers(duration_months,discount_percent,is_active))")
    .eq("id", id)
    .eq("user_id", viewer.user.id)
    .maybeSingle();
  if (!subscription || !["active", "past_due", "paused", "expired"].includes(subscription.status)) notFound();

  const service = subscription.service as unknown as { name: string } | null;
  const plan = subscription.plan as unknown as {
    plan_name: string;
    price_kes: number;
    billing_cycle: string;
    availability_status: string;
    duration_offers: Array<{ duration_months: number; discount_percent: number; is_active: boolean }>;
  } | null;
  if (!service || !plan || plan.availability_status === "unavailable") notFound();
  const durationMonths = Number(subscription.duration_months);
  const durationOffer = plan.duration_offers?.find((offer) => offer.duration_months === durationMonths && offer.is_active);
  const priceKes = isPlanDurationMonths(durationMonths)
    ? planPriceForDuration(Number(plan.price_kes), durationMonths, Number(durationOffer?.discount_percent || 0))
    : Number(plan.price_kes) * durationMonths;

  return (
    <section className="section shell page-top">
      <Link className="back-link" href={`/dashboard/subscriptions/${id}`}>← Back to subscription</Link>
      <RenewalCheckout
        subscriptionId={id}
        serviceName={service.name}
        planName={plan.plan_name}
        durationMonths={durationMonths}
        priceKes={priceKes}
        email={viewer.profile.email}
        defaultPhone={viewer.profile.phone || ""}
      />
    </section>
  );
}
