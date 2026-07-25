import { AdminInvitationForm } from "@/components/admin-invitations";
import { activateMemberOrder, createCatalogService, createMemberPlan } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "UniPlug administration" };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [servicesResult, plansResult, ordersResult, invitationsResult] = supabase ? await Promise.all([
    supabase.from("uniplug_catalog_services").select("id,name,slug,category_slug,is_active,availability_status").order("name"),
    supabase.from("uniplug_member_plans").select("id,plan_name,plan_code,price_kes,billing_cycle,is_active,availability_status,service:uniplug_catalog_services(name)").order("created_at", { ascending: false }),
    supabase.from("uniplug_member_orders").select("id,order_number,customer_email,total_kes,payment_status,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("uniplug_invitations").select("id,email,username,status,action_type,created_at,expires_at").order("created_at", { ascending: false }).limit(20)
  ]) : [empty, empty, empty, empty];

  const services = (servicesResult.data || []) as Array<{ id: string; name: string; slug: string; category_slug: string; is_active: boolean; availability_status: string }>;
  const plans = (plansResult.data || []) as Array<{ id: string; plan_name: string; plan_code: string; price_kes: number; billing_cycle: string; is_active: boolean; availability_status: string; service: { name?: string } | null }>;
  const orders = (ordersResult.data || []) as Array<{ id: string; order_number: string; customer_email: string; total_kes: number; payment_status: string; fulfillment_status: string; created_at: string }>;
  const invitations = (invitationsResult.data || []) as Array<{ id: string; email: string; username: string; status: string; action_type: string; created_at: string; expires_at: string }>;

  return (
    <section className="section shell page-top">
      <div className="page-heading">
        <p className="eyebrow">UniPlug operations</p>
        <h1>Catalog, members, payments, and activation.</h1>
        <p>Public service content is kept separate from private member pricing. Invitation links never use the username as a password.</p>
      </div>

      <div className="dashboard-stats">
        <article><span>Catalog services</span><strong>{services.filter((service) => service.is_active).length}</strong><small>Visible to guests without pricing</small></article>
        <article><span>Private plans</span><strong>{plans.filter((plan) => plan.is_active).length}</strong><small>Visible only to active members</small></article>
        <article><span>Awaiting activation</span><strong>{orders.filter((order) => order.payment_status === "paid" && order.fulfillment_status !== "active").length}</strong><small>Paid orders requiring fulfilment</small></article>
      </div>

      <div className="admin-grid" style={{ marginTop: 24 }}>
        <AdminInvitationForm />
        <section className="panel">
          <p className="eyebrow">Public catalog</p>
          <h2>Add a service</h2>
          <form action={createCatalogService} className="admin-form">
            <div className="form-row"><input name="name" placeholder="Service name" required /><input name="slug" placeholder="service-slug" /></div>
            <select name="category" defaultValue="productivity"><option value="streaming">Streaming</option><option value="music">Music</option><option value="creative">Creative</option><option value="ai">AI tools</option><option value="productivity">Productivity</option><option value="cloud">Cloud</option><option value="security">Security</option><option value="gaming">Gaming</option><option value="learning">Learning</option></select>
            <input name="shortDescription" placeholder="Short description" required />
            <textarea name="description" placeholder="Full service description" required />
            <textarea name="features" placeholder={'Features, one per line\nPremium access\nRenewal tracking'} />
            <div className="form-row"><textarea name="supportedDevices" placeholder={'Supported devices\nSmart TV\nMobile'} /><textarea name="setupRequirements" placeholder={'Setup requirements\nSupported device\nEmail access'} /></div>
            <div className="form-row"><input name="logoText" placeholder="Logo text" /><input name="accentColor" type="color" defaultValue="#6957ff" /></div>
            <input name="fulfillmentLabel" placeholder="Managed access" />
            <input name="activationWindow" placeholder="Activation window" />
            <textarea name="replacementSummary" placeholder="Replacement-policy summary" />
            <div className="form-row"><select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="coming_soon">Coming soon</option></select><label><input name="isFeatured" type="checkbox" /> Featured service</label></div>
            <button className="button button-dark">Create service</button>
          </form>
        </section>
      </div>

      <div className="admin-grid" style={{ marginTop: 24 }}>
        <section className="panel">
          <p className="eyebrow">Private pricing</p>
          <h2>Add a member plan</h2>
          <form action={createMemberPlan} className="admin-form">
            <select name="serviceId" required><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
            <div className="form-row"><input name="planName" placeholder="Plan name" required /><input name="planCode" placeholder="plan-code" /></div>
            <div className="form-row"><input name="priceKes" type="number" min="1" placeholder="Price in KSh" required /><input name="compareAtKes" type="number" min="1" placeholder="Compare-at price" /></div>
            <div className="form-row"><select name="billingCycle"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select><input name="purchaseLimit" type="number" min="1" max="20" defaultValue="1" /></div>
            <select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select>
            <textarea name="planFeatures" placeholder={'Plan features, one per line\nMonthly access\nMember support'} />
            <button className="button button-dark">Create member plan</button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Paid orders</p>
          <h2>Activation queue</h2>
          <div className="admin-list">
            {orders.map((order) => (
              <div key={order.id}>
                <div><strong>{order.order_number}</strong><span>{order.customer_email} · KSh {Number(order.total_kes).toLocaleString("en-KE")}</span><span>{new Date(order.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                {order.payment_status === "paid" && order.fulfillment_status !== "active" ? (
                  <form action={activateMemberOrder}><input type="hidden" name="orderId" value={order.id} /><button className="button button-light small">Activate</button></form>
                ) : <span className="status-pill">{order.payment_status} · {order.fulfillment_status}</span>}
              </div>
            ))}
            {!orders.length && <p>No member orders yet.</p>}
          </div>
        </section>
      </div>

      <div className="admin-grid lists">
        <section className="panel">
          <h2>Catalog services</h2>
          <div className="admin-list">{services.map((service) => <div key={service.id}><div><strong>{service.name}</strong><span>/{service.slug} · {service.category_slug}</span></div><span className="status-pill">{service.is_active ? service.availability_status : "hidden"}</span></div>)}</div>
        </section>
        <section className="panel">
          <h2>Member plans</h2>
          <div className="admin-list">{plans.map((plan) => <div key={plan.id}><div><strong>{plan.service?.name || "Service"} — {plan.plan_name}</strong><span>{plan.plan_code} · {plan.billing_cycle} · {plan.availability_status}</span></div><strong>KSh {Number(plan.price_kes).toLocaleString("en-KE")}</strong></div>)}</div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 22 }}>
        <h2>Recent invitations</h2>
        <div className="admin-list">{invitations.map((invitation) => <div key={invitation.id}><div><strong>@{invitation.username}</strong><span>{invitation.email} · {invitation.action_type}</span></div><span className="status-pill">{invitation.status}</span></div>)}</div>
      </section>
    </section>
  );
}
