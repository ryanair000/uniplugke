import { createCatalogService, createMemberPlan, updateCatalogServiceState, updateMemberPlanState } from "@/app/admin/actions";
import { AdminDrawer } from "@/components/admin-drawer";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminTabs, AdminToolbar } from "@/components/admin-console";
import { ServiceArtwork } from "@/components/service-artwork";
import { formatDualPrice } from "@/lib/currency";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalog administration" };

const successMessages: Record<string, string> = {
  service: "Catalog service created.",
  plan: "Member plan created.",
  service_updated: "Service availability updated.",
  plan_updated: "Plan availability updated."
};

export default async function AdminCatalogPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; view?: string; search?: string; status?: string }>;
}) {
  const query = await searchParams;
  const view = query.view === "plans" ? "plans" : "services";
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all");
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

  const filteredServices = services.filter((service) => {
    const matchesSearch = !search || `${service.name} ${service.slug} ${service.category_slug}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || service.availability_status === status;
    return matchesSearch && matchesStatus;
  });
  const filteredPlans = plans.filter((plan) => {
    const matchesSearch = !search || `${plan.service?.name || ""} ${plan.plan_name} ${plan.plan_code}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || plan.availability_status === status;
    return matchesSearch && matchesStatus;
  });

  const addService = (
    <AdminDrawer triggerLabel="Add service" title="Add catalog service" eyebrow="Catalog" description="Start with the fields customers actually need. Advanced operational details stay tucked away.">
      <form action={createCatalogService} className="admin-form-clean">
        <label>Service name<input name="name" placeholder="e.g. Netflix Premium" required /></label>
        <div className="admin-split-fields">
          <label>Category<select name="category" defaultValue="productivity"><option value="streaming">Streaming</option><option value="music">Music</option><option value="creative">Creative</option><option value="ai">AI tools</option><option value="productivity">Productivity</option><option value="cloud">Cloud</option><option value="security">Security</option><option value="gaming">Gaming</option><option value="learning">Learning</option></select></label>
          <label>Availability<select name="availabilityStatus" defaultValue="available"><option value="available">Available</option><option value="limited">Limited</option><option value="coming_soon">Coming soon</option></select></label>
        </div>
        <label>Catalog summary<input name="shortDescription" placeholder="One clear sentence for the service card" required /></label>
        <label>Full description<textarea name="description" placeholder="Explain the service and member value" required /></label>
        <label className="check-label"><input name="isFeatured" type="checkbox" /> Feature this service</label>
        <details>
          <summary>Advanced details</summary>
          <div className="admin-advanced-fields">
            <label>URL slug<input name="slug" placeholder="netflix-premium" /></label>
            <label>Features<textarea name="features" placeholder={"One feature per line\nPremium access\nRenewal tracking"} /></label>
            <div className="admin-split-fields">
              <label>Supported devices<textarea name="supportedDevices" placeholder={"Smart TV\nMobile\nWeb"} /></label>
              <label>Setup requirements<textarea name="setupRequirements" placeholder={"Supported device\nEmail access"} /></label>
            </div>
            <div className="admin-split-fields">
              <label>Logo text<input name="logoText" placeholder="Up to 3 characters" maxLength={3} /></label>
              <label>Accent color<input name="accentColor" type="color" defaultValue="#6957ff" /></label>
            </div>
            <label>Fulfilment label<input name="fulfillmentLabel" placeholder="Managed access" /></label>
            <label>Activation expectation<input name="activationWindow" placeholder="Usually activated after verification" /></label>
            <label>Replacement policy<textarea name="replacementSummary" placeholder="Short replacement policy summary" /></label>
          </div>
        </details>
        <button className="button button-dark" type="submit">Create service</button>
      </form>
    </AdminDrawer>
  );

  const addPlan = (
    <AdminDrawer triggerLabel="Add plan" title="Add member plan" eyebrow="Pricing" description="Use KSh as the primary admin price. Public conversion can remain a presentation detail.">
      <form action={createMemberPlan} className="admin-form-clean">
        <label>Service<select name="serviceId" required><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <div className="admin-split-fields">
          <label>Plan name<input name="planName" placeholder="e.g. Individual" required /></label>
          <label>Plan code<input name="planCode" placeholder="individual" /></label>
        </div>
        <div className="admin-split-fields">
          <label>Monthly price (KSh)<input name="priceKes" type="number" min="1" step="1" placeholder="350" required /></label>
          <label>Compare-at (KSh)<input name="compareAtKes" type="number" min="1" step="1" placeholder="Optional" /></label>
        </div>
        <div className="admin-split-fields">
          <label>Availability<select name="availabilityStatus"><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label>
          <label>Purchase limit<input name="purchaseLimit" type="number" min="1" max="20" defaultValue="1" /></label>
        </div>
        <label>Plan features<textarea name="planFeatures" placeholder={"One feature per line\nMonthly access\nMember support"} /></label>
        <button className="button button-dark" type="submit">Create member plan</button>
      </form>
    </AdminDrawer>
  );

  return (
    <section className="portal-page">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Services & plans"
        description="Manage what members can buy without keeping creation forms permanently open on the page."
        actions={view === "services" ? addService : addPlan}
      />

      {query.success && successMessages[query.success] ? <p className="admin-notice">{successMessages[query.success]}</p> : null}

      <AdminMetricStrip items={[
        { label: "Services", value: services.length, detail: "catalog entries" },
        { label: "Available", value: services.filter((item) => item.is_active && item.availability_status === "available").length, detail: "ready to sell", tone: "good" },
        { label: "Featured", value: services.filter((item) => item.is_featured).length, detail: "homepage placement" },
        { label: "Plans", value: plans.length, detail: "price options" }
      ]} />

      <AdminTabs active={view === "plans" ? "/admin/catalog?view=plans" : "/admin/catalog"} tabs={[
        { label: "Services", href: "/admin/catalog", count: services.length },
        { label: "Plans", href: "/admin/catalog?view=plans", count: plans.length }
      ]} />

      <AdminToolbar>
        <form method="get">
          {view === "plans" ? <input type="hidden" name="view" value="plans" /> : null}
          <input className="admin-search" type="search" name="search" defaultValue={query.search || ""} placeholder={view === "plans" ? "Search service, plan or code…" : "Search service, slug or category…"} />
          <select name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="limited">Limited</option>
            <option value="coming_soon">Coming soon</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <button className="button button-light" type="submit">Filter</button>
        </form>
      </AdminToolbar>

      {view === "services" ? (
        <AdminSection title="Services" description={`${filteredServices.length} matching service${filteredServices.length === 1 ? "" : "s"}`}>
          {filteredServices.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Service</th><th>Category</th><th>Plans</th><th>Availability</th><th>Featured</th><th>Manage</th></tr></thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const planCount = plans.filter((plan) => plan.service?.name === service.name).length;
                    return (
                      <tr key={service.id}>
                        <td><div className="admin-service-identity"><ServiceArtwork accentColor={service.accent_color} className="service-logo small" logoText={service.logo_text} name={service.name} slug={service.slug} /><div><strong>{service.name}</strong><small>/{service.slug} · {service.short_description}</small></div></div></td>
                        <td>{service.category_slug}</td>
                        <td>{planCount}</td>
                        <td><AdminStatus value={service.is_active ? service.availability_status : "hidden"} /></td>
                        <td>{service.is_featured ? <AdminStatus value="active" label="Featured" /> : <span className="admin-row-subtext">No</span>}</td>
                        <td>
                          <form action={updateCatalogServiceState} className="admin-inline-form">
                            <input name="serviceId" type="hidden" value={service.id} />
                            <select name="availabilityStatus" defaultValue={service.availability_status} aria-label={`Availability for ${service.name}`}>
                              <option value="available">Available</option><option value="limited">Limited</option><option value="coming_soon">Coming soon</option><option value="unavailable">Unavailable</option>
                            </select>
                            <button className="button button-light small" type="submit">Save</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <AdminEmptyState title="No services match" description="Clear the filters or add a new catalog service." />}
        </AdminSection>
      ) : (
        <AdminSection title="Member plans" description={`${filteredPlans.length} matching plan${filteredPlans.length === 1 ? "" : "s"}`}>
          {filteredPlans.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Plan</th><th>Service</th><th>Price</th><th>Cycle</th><th>Availability</th><th>Manage</th></tr></thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td><strong>{plan.plan_name}</strong><small>{plan.plan_code}</small></td>
                      <td>{plan.service?.name || "Service"}</td>
                      <td><strong>{formatDualPrice(Number(plan.price_kes))}</strong></td>
                      <td>{plan.billing_cycle}</td>
                      <td><AdminStatus value={plan.is_active ? plan.availability_status : "hidden"} /></td>
                      <td>
                        <form action={updateMemberPlanState} className="admin-inline-form">
                          <input name="planId" type="hidden" value={plan.id} />
                          <select name="availabilityStatus" defaultValue={plan.availability_status} aria-label={`Availability for ${plan.plan_name}`}>
                            <option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option>
                          </select>
                          <button className="button button-light small" type="submit">Save</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <AdminEmptyState title="No plans match" description="Clear the filters or add a member plan." />}
        </AdminSection>
      )}
    </section>
  );
}
