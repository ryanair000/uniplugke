import { createCatalogService, createMemberPlan } from "@/app/admin/actions";
import { ServiceArtwork } from "@/components/service-artwork";
import { formatDualPrice } from "@/lib/currency";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalog administration" };

export default async function AdminCatalogPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [servicesResult, plansResult] = supabase
    ? await Promise.all([
        supabase.from("uniplug_catalog_services").select("id,name,slug,category_slug,is_active,is_featured,availability_status,short_description,logo_text,accent_color").order("name"),
        supabase.from("uniplug_member_plans").select("id,plan_name,plan_code,price_kes,billing_cycle,is_active,availability_status,service:uniplug_catalog_services(name)").order("created_at", { ascending: false })
      ])
    : [empty, empty];
  const services = (servicesResult.data || []) as Array<{
    id: string;
    name: string;
    slug: string;
    category_slug: string;
    is_active: boolean;
    is_featured: boolean;
    availability_status: string;
    short_description: string;
    logo_text: string;
    accent_color: string;
  }>;
  const plans = (plansResult.data || []) as unknown as Array<{
    id: string;
    plan_name: string;
    plan_code: string;
    price_kes: number;
    billing_cycle: string;
    is_active: boolean;
    availability_status: string;
    service: { name: string } | null;
  }>;

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">Merchandising</p><h1>Catalog & member plans</h1><p>Manage the private catalog and its dollar prices.</p></div>
      </div>
      {query.success ? <p className="form-success page-notice">{query.success === "plan" ? "Member plan created." : "Catalog service created."}</p> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>Services</span><strong>{services.length}</strong><small>Private catalog entries</small></article>
        <article><span>Featured</span><strong>{services.filter((service) => service.is_featured).length}</strong><small>Homepage placement</small></article>
        <article><span>Member plans</span><strong>{plans.length}</strong><small>Private price options</small></article>
      </div>

      <div className="admin-grid catalog-form-grid">
        <section className="panel">
          <p className="eyebrow">Private catalog</p>
          <h2>Add a service</h2>
          <p className="muted-copy">Only invited, active clients can open the storefront and view this catalog.</p>
          <form action={createCatalogService} className="admin-form">
            <div className="form-row">
              <label className="field">Service name<input name="name" placeholder="e.g. Netflix Premium" required /></label>
              <label className="field">URL slug<input name="slug" placeholder="netflix-premium" /></label>
            </div>
            <label className="field">Category<select name="category" defaultValue="productivity"><option value="streaming">Streaming</option><option value="music">Music</option><option value="creative">Creative</option><option value="ai">AI tools</option><option value="productivity">Productivity</option><option value="cloud">Cloud</option><option value="security">Security</option><option value="gaming">Gaming</option><option value="learning">Learning</option></select></label>
            <label className="field">Catalog summary<input name="shortDescription" placeholder="One clear sentence for catalog cards" required /></label>
            <label className="field">Full description<textarea name="description" placeholder="Explain the service, activation, and member value" required /></label>
            <label className="field">Features<textarea name="features" placeholder={"One feature per line\nPremium access\nRenewal tracking"} /></label>
            <div className="form-row">
              <label className="field">Supported devices<textarea name="supportedDevices" placeholder={"One per line\nSmart TV\nMobile"} /></label>
              <label className="field">Setup requirements<textarea name="setupRequirements" placeholder={"One per line\nSupported device\nEmail access"} /></label>
            </div>
            <div className="form-row">
              <label className="field">Logo text<input name="logoText" placeholder="Up to 3 characters" maxLength={3} /></label>
              <label className="field">Accent color<input name="accentColor" type="color" defaultValue="#6957ff" /></label>
            </div>
            <label className="field">Fulfilment label<input name="fulfillmentLabel" placeholder="e.g. Managed access" /></label>
            <label className="field">Activation expectation<input name="activationWindow" placeholder="e.g. Usually activated after verification" /></label>
            <label className="field">Replacement policy summary<textarea name="replacementSummary" placeholder="Explain when support or replacement may apply" /></label>
            <div className="form-row">
              <label className="field">Availability<select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="coming_soon">Coming soon</option></select></label>
              <label className="check-label"><input name="isFeatured" type="checkbox" /> Featured service</label>
            </div>
            <button className="button button-dark">Create service</button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Private pricing</p>
          <h2>Add a member plan</h2>
          <p className="muted-copy">Enter the monthly member price in US dollars.</p>
          <form action={createMemberPlan} className="admin-form">
            <label className="field">Service<select name="serviceId" required><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
            <div className="form-row">
              <label className="field">Plan name<input name="planName" placeholder="e.g. Individual plan" required /></label>
              <label className="field">Plan code<input name="planCode" placeholder="individual-plan" /></label>
            </div>
            <div className="form-row">
              <label className="field">Monthly price ($)<input name="priceUsd" type="number" min="0.01" step="0.01" placeholder="e.g. 5.00" required /></label>
              <label className="field">Compare-at price ($)<input name="compareAtUsd" type="number" min="0.01" step="0.01" placeholder="Optional" /></label>
            </div>
            <div className="form-row">
              <label className="field">Available durations<input value="3 months · 6 months · 12 months · 3 years" readOnly /></label>
              <input name="billingCycle" type="hidden" value="monthly" />
              <label className="field">Purchase limit<input name="purchaseLimit" type="number" min="1" max="20" defaultValue="1" /></label>
            </div>
            <label className="field">Availability<select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label>
            <label className="field">Plan features<textarea name="planFeatures" placeholder={"One feature per line\nMonthly access\nMember support"} /></label>
            <button className="button button-dark">Create member plan</button>
          </form>
        </section>
      </div>

      <div className="admin-grid lists">
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Private inventory</p><h2>Services</h2></div></div>
          <div className="admin-list">
            {services.map((service) => <div key={service.id}><div className="admin-service-identity"><ServiceArtwork accentColor={service.accent_color} className="service-logo small" logoText={service.logo_text} name={service.name} slug={service.slug} /><div><strong>{service.name}</strong><span>/{service.slug} · {service.category_slug}</span><span>{service.short_description}</span></div></div><span className={`status-pill status-${service.availability_status}`}>{service.is_active ? service.availability_status : "hidden"}</span></div>)}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Private inventory</p><h2>Member plans</h2></div></div>
          <div className="admin-list">
            {plans.map((plan) => <div key={plan.id}><div><strong>{plan.service?.name || "Service"} — {plan.plan_name}</strong><span>{plan.plan_code} · {plan.billing_cycle} · {plan.availability_status}</span></div><strong>{formatDualPrice(Number(plan.price_kes))}</strong></div>)}
          </div>
        </section>
      </div>
    </section>
  );
}
