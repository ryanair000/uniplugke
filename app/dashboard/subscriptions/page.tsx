import Link from "next/link";
import { StatusBadge, daysUntil, formatDate, formatKes, renewalLabel } from "@/components/member-dashboard";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Services" };

type Subscription = {
  id: string;
  status: string;
  start_at: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  service: { id: string; name: string; slug: string; short_description: string; logo_text: string; accent_color: string } | null;
  plan: { id: string; plan_name: string; price_kes: number; billing_cycle: string; availability_status: string } | null;
};

const filters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expiring", label: "Expiring soon" },
  { key: "pending", label: "Pending" },
  { key: "paused", label: "Paused" },
  { key: "expired", label: "Expired" }
];

function matchesFilter(item: Subscription, filter: string) {
  if (filter === "all") return true;
  if (filter === "active") return item.status === "active";
  if (filter === "paused") return item.status === "paused";
  if (filter === "expired") return ["expired", "cancelled", "canceled"].includes(item.status);
  if (filter === "pending") return ["pending_activation", "past_due"].includes(item.status);
  if (filter === "expiring") {
    const days = daysUntil(item.current_period_end);
    return item.status === "active" && days != null && days >= 0 && days <= 7;
  }
  return true;
}

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const viewer = await requireMember();
  const query = await searchParams;
  const filter = filters.some((item) => item.key === query.status) ? query.status! : "all";
  const supabase = await createServerSupabaseClient();
  const { data, error } = supabase
    ? await supabase
        .from("uniplug_member_subscriptions")
        .select("id,status,start_at,current_period_end,auto_renew,service:uniplug_catalog_services(id,name,slug,short_description,logo_text,accent_color),plan:uniplug_member_plans(id,plan_name,price_kes,billing_cycle,availability_status)")
        .eq("user_id", viewer.user.id)
        .order("current_period_end")
    : { data: [], error: null };

  const subscriptions = (data || []) as unknown as Subscription[];
  const visible = subscriptions.filter((item) => matchesFilter(item, filter));
  const activeCount = subscriptions.filter((item) => item.status === "active").length;
  const expiringCount = subscriptions.filter((item) => matchesFilter(item, "expiring")).length;
  const pendingCount = subscriptions.filter((item) => matchesFilter(item, "pending")).length;

  return (
    <section className="member-page">
      <div className="dashboard-heading dashboard-heading-v2">
        <div><p className="eyebrow">My services</p><h1>Subscriptions</h1><p>See what is active, what is expiring, and what needs your attention.</p></div>
        <Link className="button button-dark" href="/services">Add a service</Link>
      </div>

      {error ? <div className="dashboard-notice notice-danger"><div><strong>Could not load all services</strong><p>Refresh the page or contact support if the problem continues.</p></div><Link href="/dashboard/support">Get help →</Link></div> : null}

      <div className="dashboard-stats compact-stats dashboard-stats-v2 service-stats">
        <article><span>Total services</span><strong>{subscriptions.length}</strong><small>All current and previous subscriptions</small></article>
        <article><span>Active</span><strong>{activeCount}</strong><small>Services available now</small></article>
        <article><span>Expiring soon</span><strong>{expiringCount}</strong><small>Ending within 7 days</small></article>
        <article><span>Pending</span><strong>{pendingCount}</strong><small>Activation or account attention</small></article>
      </div>

      <div className="dashboard-filter-bar" aria-label="Filter services">
        {filters.map((item) => <Link className={filter === item.key ? "active" : ""} href={item.key === "all" ? "/dashboard/subscriptions" : `/dashboard/subscriptions?status=${item.key}`} key={item.key}>{item.label}</Link>)}
      </div>

      {visible.length ? (
        <div className="service-management-grid">
          {visible.map((item) => {
            const days = daysUntil(item.current_period_end);
            const urgent = item.status === "active" && days != null && days >= 0 && days <= 7;
            return (
              <article className={`service-management-card${urgent ? " urgent" : ""}`} key={item.id}>
                <div className="service-card-heading">
                  <div className="service-logo" style={{ background: item.service?.accent_color || "#6957ff" }}>{item.service?.logo_text || "UP"}</div>
                  <StatusBadge status={urgent ? "expiring" : item.status} label={urgent ? "Expiring soon" : undefined} />
                </div>
                <div className="service-management-copy">
                  <h2>{item.service?.name || "Digital service"}</h2>
                  <p>{item.service?.short_description || "Managed through your UniPlug membership."}</p>
                </div>
                <div className="service-plan-line"><strong>{item.plan?.plan_name || "Member plan"}</strong><span>{item.plan ? `${formatKes(item.plan.price_kes)} / ${item.plan.billing_cycle}` : "Pricing unavailable"}</span></div>
                <div className="service-date-line"><span>Period end</span><strong>{item.current_period_end ? formatDate(item.current_period_end, { dateStyle: "long" }) : "Not scheduled"}</strong><small>{renewalLabel(item.current_period_end)}</small></div>
                <div className="service-card-actions">
                  <Link className="button button-light" href={`/dashboard/subscriptions/${item.id}`}>Manage</Link>
                  {item.service?.slug ? <Link className="text-link" href={`/services/${item.service.slug}`}>View service</Link> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state dashboard-empty"><h3>No services in this view</h3><p>{subscriptions.length ? "Try another status filter." : "Your purchases and assigned services will appear here."}</p>{!subscriptions.length ? <Link className="button button-dark" href="/services">Browse services</Link> : <Link className="button button-light" href="/dashboard/subscriptions">Show all services</Link>}</div>
      )}
    </section>
  );
}
