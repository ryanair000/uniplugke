import { createCatalogService, createMemberPlan, updateCatalogStartingPrice } from "@/app/admin/actions";
import { ServiceArtwork } from "@/components/service-artwork";
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
        supabase.from("uniplug_catalog_services").select("id,name,slug,category_slug,is_active,is_featured,availability_status,short_description,logo_text,accent_color,starting_price_usd").order("name"),
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
    starting_price_usd: number | null;
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
        <div><p className="eyebrow">Merchandising</p><h1>Catalog & member plans</h1><p>Control public USD starting prices and the exact KSh plans available after member sign-in.</p></div>
      </div>
      {query.success ? <p className="form-success page-notice">{query.success === "plan" ? "Member plan created." : query.success === "public-price" ? "Public USD price updated." : "Catalog service created."}</p> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>Services</span><strong>{services.length}</strong><small>Public catalog entries</small></article>
        <article><span>Featured</span><strong>{services.filter((service) => service.is_featured).length}</strong><small>Homepage placement</small></article>
        <article><span>Member plans</span><strong>{plans.length}</strong><small>Private price options</small></article>
      </div>

      <div className="admin-grid catalog-form-grid">
        <section className="panel">
          <p className="eyebrow">Public catalog</p>
          <h2>Add a service</h2>
          <p className="muted-copy">This content is visible before sign-in. Add a USD starting price; exact KSh plans stay member-only.</p>
          <form action={createCatalogService} className="admin-form">
            <div className="form-row"><input name="name" placeholder="Service name" required /><input name="slug" placeholder="service-slug" /></div>
            <select name="category" defaultValue="productivity"><option value="streaming">Streaming</option><option value="music">Music</option><option value="creative">Creative</option><option value="ai">AI tools</option><option value="productivity">Productivity</option><option value="cloud">Cloud</option><option value="security">Security</option><option value="gaming">Gaming</option><option value="learning">Learning</option></select>
            <input name="shortDescription" placeholder="Short catalog description" required />
            <textarea name="description" placeholder="Full service description" required />
            <textarea name="features" placeholder={"Features, one per line\nPremium access\nRenewal tracking"} />
            <div className="form-row"><textarea name="supportedDevices" placeholder={"Supported devices\nSmart TV\nMobile"} /><textarea name="setupRequirements" placeholder={"Setup requirements\nSupported device\nEmail access"} /></div>
            <div className="form-row"><input name="logoText" placeholder="Logo text" maxLength={3} /><input aria-label="Accent color" name="accentColor" type="color" defaultValue="#6957ff" /></div>
            <input name="startingPriceUsd" type="number" min="0.01" step="0.01" placeholder="Public starting price in USD" />
            <input name="fulfillmentLabel" placeholder="Managed access" />
            <input name="activationWindow" placeholder="Activation window" />
            <textarea name="replacementSummary" placeholder="Replacement-policy summary" />
            <div className="form-row"><select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="coming_soon">Coming soon</option></select><label className="check-label"><input name="isFeatured" type="checkbox" /> Featured service</label></div>
            <button className="button button-dark">Create service</button>
          </form>
        </section>

        <section className="panel">
          <p className="eyebrow">Private pricing</p>
          <h2>Add a member plan</h2>
          <p className="muted-copy">Only signed-in active members can see these plan prices.</p>
          <form action={createMemberPlan} className="admin-form">
            <select name="serviceId" required><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
            <div className="form-row"><input name="planName" placeholder="Plan name" required /><input name="planCode" placeholder="plan-code" /></div>
            <div className="form-row"><input name="priceKes" type="number" min="1" placeholder="Price in KSh" required /><input name="compareAtKes" type="number" min="1" placeholder="Compare-at price" /></div>
            <div className="form-row"><select name="billingCycle"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select><input aria-label="Purchase limit" name="purchaseLimit" type="number" min="1" max="20" defaultValue="1" /></div>
            <select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select>
            <textarea name="planFeatures" placeholder={"Plan features, one per line\nMonthly access\nMember support"} />
            <button className="button button-dark">Create member plan</button>
          </form>
        </section>
      </div>

      <div className="admin-grid lists">
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Public inventory</p><h2>Services</h2></div></div>
          <div className="admin-list">
            {services.map((service) => <div key={service.id}><div className="admin-service-identity"><ServiceArtwork accentColor={service.accent_color} className="service-logo small" logoText={service.logo_text} name={service.name} slug={service.slug} /><div><strong>{service.name}</strong><span>/{service.slug} · {service.category_slug}</span><span>{service.short_description}</span><span>{service.starting_price_usd == null ? "No public price" : `$${Number(service.starting_price_usd).toFixed(2)} USD public`}</span></div></div><div className="public-price-admin"><span className={`status-pill status-${service.availability_status}`}>{service.is_active ? service.availability_status : "hidden"}</span><form action={updateCatalogStartingPrice}><input name="serviceId" type="hidden" value={service.id} /><input aria-label={`Public USD price for ${service.name}`} name="startingPriceUsd" type="number" min="0.01" step="0.01" defaultValue={service.starting_price_usd ?? ""} placeholder="USD" required /><button className="button button-light small">Update USD</button></form></div></div>)}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Private inventory</p><h2>Member plans</h2></div></div>
          <div className="admin-list">
            {plans.map((plan) => <div key={plan.id}><div><strong>{plan.service?.name || "Service"} — {plan.plan_name}</strong><span>{plan.plan_code} · {plan.billing_cycle} · {plan.availability_status}</span></div><strong>KSh {Number(plan.price_kes).toLocaleString("en-KE")}</strong></div>)}
          </div>
        </section>
      </div>
    </section>
  );
}
