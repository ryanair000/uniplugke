import Link from "next/link";
import { notFound } from "next/navigation";
import { RenewalCheckout } from "@/components/renewal-checkout";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Renew subscription" };

export default async function RenewalPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const { data: subscription } = await supabase
    .from("uniplug_member_subscriptions")
    .select("id,status,duration_months,service:uniplug_catalog_services(name),plan:uniplug_member_plans(plan_name,price_kes,billing_cycle,availability_status)")
    .eq("id", id)
    .eq("user_id", viewer.user.id)
    .maybeSingle();
  if (!subscription || !["active", "past_due", "paused", "expired"].includes(subscription.status)) notFound();

  const service = subscription.service as unknown as { name: string } | null;
  const plan = subscription.plan as unknown as { plan_name: string; price_kes: number; billing_cycle: string; availability_status: string } | null;
  if (!service || !plan || plan.availability_status === "unavailable") notFound();

  return (
    <section className="section shell page-top">
      <Link className="back-link" href={`/dashboard/subscriptions/${id}`}>← Back to subscription</Link>
      <RenewalCheckout
        subscriptionId={id}
        serviceName={service.name}
        planName={plan.plan_name}
        durationMonths={Number(subscription.duration_months)}
        priceKes={Number(plan.price_kes) * Number(subscription.duration_months)}
        email={viewer.profile.email}
        defaultPhone={viewer.profile.phone || ""}
      />
    </section>
  );
}
