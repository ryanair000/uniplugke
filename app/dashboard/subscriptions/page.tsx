import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { requireMember } from "@/lib/auth";
import { planDurationLabel } from "@/lib/plan-durations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My subscriptions" };

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function SubscriptionsPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase
        .from("uniplug_member_subscriptions")
        .select("id,status,start_at,current_period_start,current_period_end,duration_months,service:uniplug_catalog_services(name,slug,logo_text,accent_color),plan:uniplug_member_plans(plan_name,billing_cycle)")
        .eq("user_id", viewer.user.id)
        .order("current_period_end")
    : { data: [] };

  const subscriptions = (data || []) as unknown as Array<{
    id: string;
    status: string;
    start_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    duration_months: number;
    service: { name: string; slug: string; logo_text: string; accent_color: string } | null;
    plan: { plan_name: string; billing_cycle: string } | null;
  }>;
  const active = subscriptions.filter((subscription) => subscription.status === "active").length;
  const scheduledRenewals = subscriptions.filter((subscription) => Boolean(subscription.current_period_end)).length;

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Subscriptions</h1>
          <p>Track every connected service, renewal date, and account request in one place.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-dark" href="/services">Add a service</Link>
        </div>
      </div>

      <div className="dashboard-stats compact-stats">
        <article><span>All services</span><strong>{subscriptions.length}</strong><small>Connected to this account</small></article>
        <article><span>Active</span><strong>{active}</strong><small>Available for use</small></article>
        <article><span>Scheduled renewals</span><strong>{scheduledRenewals}</strong><small>Renewal date confirmed</small></article>
      </div>

      <section className="panel portal-table-panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">Service library</p><h2>All subscriptions</h2></div>
        </div>
        {subscriptions.length ? (
          <div className="subscription-list">
            {subscriptions.map((subscription) => (
              <Link className="subscription-row" href={`/dashboard/subscriptions/${subscription.id}`} key={subscription.id}>
                <ServiceArtwork
                  accentColor={subscription.service?.accent_color || "#6957ff"}
                  className="service-logo small"
                  logoText={subscription.service?.logo_text || "UP"}
                  name={subscription.service?.name || "Digital service"}
                  slug={subscription.service?.slug}
                />
                <div>
                  <strong>{subscription.service?.name || "Digital service"}</strong>
                  <span>{subscription.plan?.plan_name || "Member plan"} · {planDurationLabel(Number(subscription.duration_months))}</span>
                </div>
                <span className={`status-pill status-${subscription.status}`}>{readableStatus(subscription.status)}</span>
                <span>
                  {subscription.current_period_end
                    ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString("en-KE", { dateStyle: "medium" })}`
                    : "Activation pending"}
                </span>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No subscriptions yet</h3>
            <p>Services purchased through your member account will appear here.</p>
            <Link className="button button-dark" href="/services">Explore the catalog</Link>
          </div>
        )}
      </section>
    </section>
  );
}
