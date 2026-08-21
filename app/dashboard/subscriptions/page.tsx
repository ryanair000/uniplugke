import Link from "next/link";
import { ServiceArtwork } from "@/components/service-artwork";
import { TrackedSubscriptionsPage } from "@/components/tracked-client-views";
import { requireMember } from "@/lib/auth";
import { getTrackedSubscriptions } from "@/lib/client-portal";
import { memberStatusClass, memberStatusLabel, servicePeriodCopy } from "@/lib/member-dashboard";
import { planDurationLabel } from "@/lib/plan-durations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My subscriptions" };

export default async function SubscriptionsPage() {
  const viewer = await requireMember();
  if (viewer.profile.clientId) {
    return <TrackedSubscriptionsPage subscriptions={await getTrackedSubscriptions(viewer.profile.clientId)} />;
  }

  const supabase = await createServerSupabaseClient();
  const result = supabase
    ? await supabase
        .from("uniplug_member_subscriptions")
        .select("id,status,start_at,current_period_end,duration_months,auto_renew,service:uniplug_catalog_services(name,slug,logo_text,accent_color),plan:uniplug_member_plans(plan_name,billing_cycle)")
        .eq("user_id", viewer.user.id)
        .order("current_period_end")
    : null;

  const subscriptions = ((result?.data || []) as unknown) as Array<{
    id: string;
    status: string;
    start_at: string | null;
    current_period_end: string | null;
    duration_months: number;
    auto_renew: boolean;
    service: { name: string; slug: string; logo_text: string; accent_color: string } | null;
    plan: { plan_name: string; billing_cycle: string } | null;
  }>;
  const active = subscriptions.filter((subscription) => subscription.status === "active").length;
  const now = Date.now();
  const upcomingDates = subscriptions.filter((subscription) =>
    ["active", "past_due"].includes(subscription.status) &&
    Boolean(subscription.current_period_end) &&
    new Date(subscription.current_period_end!).getTime() >= now
  ).length;
  const unavailable = !supabase || Boolean(result?.error);

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Subscriptions</h1>
          <p>Track every connected service, access date, and account request in one place.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-dark" href="/services">Add a service</Link>
        </div>
      </div>

      {unavailable ? <p className="form-error page-notice">Your services could not be loaded. Refresh this page to try again.</p> : null}

      {!unavailable ? <div className="dashboard-stats compact-stats">
        <article><span>All services</span><strong>{subscriptions.length}</strong><small>Connected to this account</small></article>
        <article><span>Active</span><strong>{active}</strong><small>Available for use</small></article>
        <article><span>Upcoming dates</span><strong>{upcomingDates}</strong><small>Expiry or renewal date scheduled</small></article>
      </div> : null}

      <section className="panel portal-table-panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">Service library</p><h2>All subscriptions</h2></div>
        </div>
        {unavailable ? (
          <div className="empty-state"><h3>We could not load your services</h3><p>Refresh this page to try again.</p><Link className="button button-light" href="/dashboard/subscriptions">Retry</Link></div>
        ) : subscriptions.length ? (
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
                <span className={memberStatusClass(subscription.status)}>{memberStatusLabel(subscription.status)}</span>
                <span>{servicePeriodCopy(subscription.current_period_end, subscription.auto_renew)}</span>
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
