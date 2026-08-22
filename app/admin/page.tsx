import Link from "next/link";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus } from "@/components/admin-console";
import { formatDualPrice } from "@/lib/currency";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations overview" };

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [profilesResult, ordersResult, requestsResult, servicesResult, replacementResult, alertResult] = await Promise.all([
    supabase ? supabase.from("uniplug_profiles").select("user_id,status").limit(500) : empty,
    supabase ? supabase.from("uniplug_member_orders").select("id,order_number,customer_email,total_kes,payment_status,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(20) : empty,
    supabase ? supabase.from("uniplug_subscription_requests").select("id,request_type,status,created_at,profile:uniplug_profiles(display_name,username),subscription:uniplug_member_subscriptions(service:uniplug_catalog_services(name))").eq("status", "pending").order("created_at").limit(20) : empty,
    supabase ? supabase.from("uniplug_catalog_services").select("id,is_active,availability_status").limit(500) : empty,
    admin ? admin.from("uniplug_replacement_approvals").select("id,user_id,service_name,reason,status,created_at").eq("status", "pending").order("created_at").limit(20) : empty,
    admin ? admin.from("uniplug_verify_alerts").select("id,category,severity,status,provider,mailbox_email,last_seen_at").eq("status", "open").order("last_seen_at", { ascending: false }).limit(20) : empty
  ]);

  const profiles = (profilesResult.data || []) as Array<{ user_id: string; status: string }>;
  const orders = (ordersResult.data || []) as Array<{ id: string; order_number: string; customer_email: string; total_kes: number; payment_status: string; fulfillment_status: string; created_at: string }>;
  const requests = (requestsResult.data || []) as unknown as Array<{ id: string; request_type: string; status: string; created_at: string; profile: { display_name: string | null; username: string } | null; subscription: { service: { name: string } | null } | null }>;
  const services = (servicesResult.data || []) as Array<{ id: string; is_active: boolean; availability_status: string }>;
  const replacements = (replacementResult.data || []) as Array<{ id: string; user_id: string; service_name: string; reason: string; status: string; created_at: string }>;
  const alerts = (alertResult.data || []) as Array<{ id: string; category: string; severity: string; status: string; provider: string; mailbox_email: string | null; last_seen_at: string }>;
  const activationQueue = orders.filter((order) => order.payment_status === "paid" && !["active", "completed"].includes(order.fulfillment_status));
  const attentionCount = activationQueue.length + requests.length + replacements.length + alerts.length;

  return (
    <section className="portal-page">
      <AdminPageHeader
        eyebrow="Overview"
        title="Operations queue"
        description="Start with work that needs a decision. Navigation lives in the sidebar; this page only surfaces what needs attention now."
        actions={<><Link className="button button-light" href="/admin/members">Members</Link><Link className="button button-dark" href="/admin/catalog">Catalog</Link></>}
      />

      <AdminMetricStrip items={[
        { label: "Needs attention", value: attentionCount, detail: "across active queues", tone: attentionCount ? "warning" : "good" },
        { label: "Activation queue", value: activationQueue.length, detail: "paid orders to fulfil", tone: activationQueue.length ? "warning" : "good" },
        { label: "Open requests", value: requests.length + replacements.length, detail: `${replacements.length} replacement${replacements.length === 1 ? "" : "s"}` },
        { label: "Active members", value: profiles.filter((profile) => profile.status === "active").length, detail: `${services.filter((service) => service.is_active && service.availability_status !== "unavailable").length} live services` }
      ]} />

      <div className="admin-section-grid">
        <AdminSection title="Paid orders to activate" description="Only orders that are already paid and still need fulfilment." action={<Link className="button button-light small" href="/admin/orders">View orders</Link>}>
          {activationQueue.length ? <div className="admin-attention-list">{activationQueue.slice(0, 6).map((order) => <div className="admin-attention-row" key={order.id}><div><strong>{order.order_number}</strong><p>{order.customer_email} · {new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p></div><div style={{ textAlign: "right" }}><strong>{formatDualPrice(Number(order.total_kes))}</strong><p>{order.fulfillment_status.replaceAll("_", " ")}</p></div></div>)}</div> : <AdminEmptyState title="Activation queue cleared" description="There are no paid member orders waiting for activation." />}
        </AdminSection>

        <AdminSection title="Member decisions" description="Pause, cancellation and replacement requests waiting for admin review." action={<Link className="button button-light small" href="/admin/requests">Open requests</Link>}>
          {requests.length || replacements.length ? <div className="admin-attention-list">{requests.slice(0, 4).map((request) => <div className="admin-attention-row" key={request.id}><div><strong>{request.request_type === "pause" ? "Pause" : "Cancellation"} · {request.subscription?.service?.name || "Service"}</strong><p>{request.profile?.display_name || `@${request.profile?.username || "member"}`} · {new Date(request.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p></div><AdminStatus value="pending" /></div>)}{replacements.slice(0, 3).map((request) => <div className="admin-attention-row" key={request.id}><div><strong>Replacement · {request.service_name}</strong><p>Member {request.user_id.slice(0, 8)} · {request.reason.replaceAll("_", " ")}</p></div><AdminStatus value="attention" label="Review" /></div>)}</div> : <AdminEmptyState title="No member decisions" description="Subscription and replacement queues are clear." />}
        </AdminSection>
      </div>

      <AdminSection title="VeriFy attention" description="Only active provider or mailbox signals are shown here." action={<Link className="button button-light small" href="/admin/mailboxes?view=alerts">Open VeriFy</Link>}>
        {alerts.length ? <div className="admin-attention-list">{alerts.slice(0, 8).map((alert) => <div className="admin-attention-row" key={alert.id}><div><strong>{alert.category.replaceAll("_", " ")}</strong><p>{alert.mailbox_email || alert.provider} · last seen {new Date(alert.last_seen_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p></div><AdminStatus value={alert.severity} label={alert.severity} /></div>)}</div> : <AdminEmptyState title="VeriFy is quiet" description="There are no open operational alerts." />}
      </AdminSection>
    </section>
  );
}
