import { updateKeyRequest } from "@/app/admin/key-requests/actions";
import { AdminDrawer } from "@/components/admin-drawer";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminToolbar } from "@/components/admin-console";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Software-key requests" };

export default async function AdminKeyRequestsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; search?: string; status?: string }> }) {
  const query = await searchParams;
  const admin = createAdminSupabaseClient();
  const { data } = admin
    ? await admin.from("uniplug_key_requests").select("id,request_reference,software_name,platform,customer_email,customer_phone,notes,status,admin_note,created_at,updated_at").order("created_at", { ascending: false }).limit(200)
    : { data: [] };
  const requests = (data || []) as Array<{ id: string; request_reference: string; software_name: string; platform: string; customer_email: string; customer_phone: string; notes: string | null; status: string; admin_note: string | null; created_at: string; updated_at: string }>;
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all");
  const filtered = requests.filter((request) => {
    const matchesSearch = !search || `${request.software_name} ${request.platform} ${request.customer_email} ${request.customer_phone || ""} ${request.request_reference}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || request.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <section className="portal-page">
      <AdminPageHeader eyebrow="Key sourcing" title="Software-key requests" description="Scan the sourcing queue quickly. Notes and status controls only appear when a request is opened." />
      {query.success ? <p className="admin-notice">Request updated.</p> : null}
      {query.error ? <p className="admin-notice error">The request could not be updated.</p> : null}

      <AdminMetricStrip items={[
        { label: "New", value: requests.filter((item) => item.status === "new").length, detail: "not reviewed", tone: requests.some((item) => item.status === "new") ? "warning" : "good" },
        { label: "Reviewing", value: requests.filter((item) => item.status === "reviewing").length, detail: "terms being checked" },
        { label: "Quoted", value: requests.filter((item) => item.status === "quoted").length, detail: "customer contacted" },
        { label: "Sourced", value: requests.filter((item) => item.status === "sourced").length, detail: "software located", tone: "good" }
      ]} />

      <AdminToolbar>
        <form method="get">
          <input className="admin-search" type="search" name="search" defaultValue={query.search || ""} placeholder="Search software, customer or reference…" />
          <select name="status" defaultValue={status}><option value="all">All statuses</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="quoted">Quoted</option><option value="sourced">Sourced</option><option value="closed">Closed</option></select>
          <button className="button button-light" type="submit">Filter</button>
        </form>
      </AdminToolbar>

      <AdminSection title="Sourcing queue" description={`${filtered.length} matching request${filtered.length === 1 ? "" : "s"}`}>
        {filtered.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Software</th><th>Customer</th><th>Reference</th><th>Requested</th><th>Status</th><th>Manage</th></tr></thead><tbody>{filtered.map((request) => <tr key={request.id}><td><strong>{request.software_name}</strong><small>{request.platform}</small></td><td><strong>{request.customer_email}</strong><small>{request.customer_phone || "No phone"}</small></td><td><span className="admin-code">{request.request_reference}</span></td><td>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td><td><AdminStatus value={request.status} /></td><td><AdminDrawer triggerLabel="Manage" triggerClassName="button button-light small" title={request.software_name} eyebrow="Key sourcing" description={`${request.platform} · ${request.request_reference}`}><div className="admin-stack"><dl className="admin-detail-grid"><div><dt>Customer</dt><dd>{request.customer_email}</dd></div><div><dt>Phone</dt><dd>{request.customer_phone || "Not saved"}</dd></div><div><dt>Requested</dt><dd>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</dd></div></dl><div className="admin-compact-card"><strong>Customer notes</strong><p style={{ whiteSpace: "pre-wrap" }}>{request.notes || "No optional notes."}</p></div><form action={updateKeyRequest} className="admin-form-clean"><input name="requestId" type="hidden" value={request.id} /><label>Internal sourcing note<textarea defaultValue={request.admin_note || ""} maxLength={2000} name="adminNote" placeholder="Supplier, terms, quote or fulfilment note" /></label><label>Status<select defaultValue={request.status} name="status"><option value="new">New</option><option value="reviewing">Reviewing</option><option value="quoted">Quoted</option><option value="sourced">Sourced</option><option value="closed">Closed</option></select></label><button className="button button-dark small" type="submit">Save request</button></form></div></AdminDrawer></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No requests match" description="Clear the filters or wait for a new public sourcing request." />}
      </AdminSection>
    </section>
  );
}
