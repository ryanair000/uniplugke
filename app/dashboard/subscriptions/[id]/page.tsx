import Link from "next/link";
import { notFound } from "next/navigation";
import { RenewPlanButton } from "@/components/renew-plan-button";
import { ServiceArtwork } from "@/components/service-artwork";
import { requestSubscriptionAction } from "@/app/dashboard/subscriptions/actions";
import { requireMember } from "@/lib/auth";
import { formatDualPrice } from "@/lib/currency";
import { planDurationLabel } from "@/lib/plan-durations";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrackedSubscription } from "@/lib/client-portal";
import { TrackedSubscriptionDetail } from "@/components/tracked-client-views";

export const dynamic = "force-dynamic";

function readableStatus(value: string) {
  return value.replaceAll("_", " ");
}

export default async function SubscriptionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const viewer = await requireMember();
  const { id } = await params;
  if (viewer.profile.clientId) {
    const tracked = await getTrackedSubscription(viewer.profile.clientId, id);
    if (!tracked) notFound();
    return <TrackedSubscriptionDetail subscription={tracked} />;
  }
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const [{ data: subscription }, { data: requests }] = await Promise.all([
    supabase
      .from("uniplug_member_subscriptions")
      .select("id,status,start_at,current_period_end,duration_months,auto_renew,created_at,service:uniplug_catalog_services(id,name,slug,short_description,logo_text,accent_color,fulfillment_label,activation_window,replacement_summary),plan:uniplug_member_plans(id,plan_name,plan_code,price_kes,compare_at_kes,billing_cycle,plan_features,availability_status)")
      .eq("id", id)
      .eq("user_id", viewer.user.id)
      .maybeSingle(),
    supabase
      .from("uniplug_subscription_requests")
      .select("id,request_type,reason,status,admin_note,resolved_at,created_at")
      .eq("subscription_id", id)
      .eq("user_id", viewer.user.id)
      .order("created_at", { ascending: false })
  ]);
  if (!subscription) notFound();

  const service = subscription.service as unknown as {
    id: string;
    name: string;
    slug: string;
    short_description: string;
    logo_text: string;
    accent_color: string;
    fulfillment_label: string;
    activation_window: string;
    replacement_summary: string;
  } | null;
  const plan = subscription.plan as unknown as {
    id: string;
    plan_name: string;
    plan_code: string;
    price_kes: number;
    compare_at_kes: number | null;
    billing_cycle: "monthly" | "quarterly" | "yearly";
    plan_features: string[];
    availability_status: "available" | "limited" | "unavailable";
  } | null;
  const actionRequests = (requests || []) as Array<{
    id: string;
    request_type: "pause" | "cancel";
    reason: string | null;
    status: "pending" | "completed" | "declined";
    admin_note: string | null;
    resolved_at: string | null;
    created_at: string;
  }>;
  const pendingPause = actionRequests.some((request) => request.request_type === "pause" && request.status === "pending");
  const pendingCancel = actionRequests.some((request) => request.request_type === "cancel" && request.status === "pending");
  const canPause = ["active", "past_due"].includes(subscription.status) && !pendingPause;
  const canCancel = ["pending_activation", "active", "past_due", "paused"].includes(subscription.status) && !pendingCancel;
  const canRenew = Boolean(plan && service && plan.availability_status !== "unavailable" && ["active", "past_due", "paused", "expired"].includes(subscription.status));

  return (
    <section className="section shell page-top">
      <Link className="back-link" href="/dashboard">← Back to My UniPlug</Link>
      {query.success === "request_submitted" ? <p className="form-success page-notice">Your request was submitted for review.</p> : null}
      {query.error ? <p className="form-error page-notice">{query.error}</p> : null}

      <div className="subscription-detail-hero">
        <ServiceArtwork
          accentColor={service?.accent_color || "#6957ff"}
          className="service-logo detail-service-logo"
          descriptive
          logoText={service?.logo_text || "UP"}
          name={service?.name || "Digital service"}
          slug={service?.slug}
        />
        <div><p className="eyebrow">My subscription</p><h1>{service?.name || "Digital service"}</h1><p>{service?.short_description || "Your UniPlug member service."}</p><div className="tag-row"><span>{plan?.plan_name || "Member plan"}</span><span>{readableStatus(subscription.status)}</span><span>{planDurationLabel(Number(subscription.duration_months))}</span></div></div>
      </div>

      <div className="subscription-detail-grid">
        <div className="detail-main">
          <section className="panel">
            <div className="section-heading compact"><div><p className="eyebrow">Plan</p><h2>Membership details</h2></div></div>
            <dl className="detail-list">
              <div><dt>Current status</dt><dd>{readableStatus(subscription.status)}</dd></div>
              <div><dt>Started</dt><dd>{subscription.start_at ? new Date(subscription.start_at).toLocaleDateString("en-KE", { dateStyle: "long" }) : "Activation pending"}</dd></div>
              <div><dt>Current period ends</dt><dd>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-KE", { dateStyle: "long" }) : "Not scheduled"}</dd></div>
              <div><dt>Plan duration</dt><dd>{planDurationLabel(Number(subscription.duration_months))}</dd></div>
              <div><dt>Fulfilment</dt><dd>{service?.fulfillment_label || "Managed through UniPlug"}</dd></div>
              <div><dt>Activation window</dt><dd>{service?.activation_window || "Shown after verification"}</dd></div>
            </dl>
            {plan?.plan_features?.length ? <div className="feature-grid">{plan.plan_features.map((feature) => <div key={feature}>✓ {feature}</div>)}</div> : null}
          </section>

          <section className="panel">
            <div className="section-heading compact"><div><p className="eyebrow">Requests</p><h2>Pause or cancellation history</h2></div></div>
            <div className="request-history">
              {actionRequests.map((request) => (
                <article key={request.id}>
                  <div><strong>{request.request_type === "pause" ? "Pause request" : "Cancellation request"}</strong><span>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                  <span className="status-pill">{request.status}</span>
                  {request.reason ? <p>{request.reason}</p> : null}
                  {request.admin_note ? <p><b>UniPlug:</b> {request.admin_note}</p> : null}
                </article>
              ))}
              {!actionRequests.length ? <p className="muted-copy">No pause or cancellation requests have been submitted.</p> : null}
            </div>
          </section>
        </div>

        <aside className="subscription-actions-column">
          <section className="panel plan-renewal-card">
            <p className="eyebrow">Renewal</p>
            <h2>{plan?.plan_name || "Member plan"}</h2>
            {plan ? <div className="plan-price">{formatDualPrice(Number(plan.price_kes) * Number(subscription.duration_months))}<span>/ {planDurationLabel(Number(subscription.duration_months))}</span></div> : null}
            <p>A renewal creates a dedicated order and extends this subscription after payment and activation.</p>
            {plan && service ? <RenewPlanButton subscriptionId={subscription.id} disabled={!canRenew} /> : null}
            {!canRenew ? <small>This plan is not currently available for renewal.</small> : null}
          </section>

          <section className="panel request-card">
            <p className="eyebrow">Service controls</p>
            <h2>Request a change</h2>
            <p>Requests are reviewed before your service changes. Access remains unchanged while a request is pending.</p>
            <form action={requestSubscriptionAction} className="admin-form">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <input type="hidden" name="requestType" value="pause" />
              <textarea name="reason" placeholder="Reason for pausing (optional)" maxLength={1000} />
              <button className="button button-light" disabled={!canPause}>{pendingPause ? "Pause request pending" : "Request pause"}</button>
            </form>
            <form action={requestSubscriptionAction} className="admin-form destructive-form">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <input type="hidden" name="requestType" value="cancel" />
              <textarea name="reason" placeholder="Reason for cancellation (optional)" maxLength={1000} />
              <button className="button button-danger" disabled={!canCancel}>{pendingCancel ? "Cancellation pending" : "Request cancellation"}</button>
            </form>
          </section>

          <section className="panel support-card">
            <p className="eyebrow">Service support</p>
            <h2>Access issue?</h2>
            <p>{service?.replacement_summary || "Eligible service issues can be reviewed by UniPlug support."}</p>
            <Link className="button button-light" href="/help">Create support ticket</Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
