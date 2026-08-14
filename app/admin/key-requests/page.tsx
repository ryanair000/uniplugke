import { updateKeyRequest } from "@/app/admin/key-requests/actions";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Software-key requests" };

export default async function AdminKeyRequestsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams;
  const admin = createAdminSupabaseClient();
  const { data } = admin
    ? await admin.from("uniplug_key_requests").select("id,request_reference,software_name,platform,customer_email,customer_phone,notes,status,admin_note,created_at,updated_at").order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  const requests = (data || []) as Array<{ id: string; request_reference: string; software_name: string; platform: string; customer_email: string; customer_phone: string; notes: string | null; status: string; admin_note: string | null; created_at: string; updated_at: string }>;

  return (
    <section className="section page-top portal-page">
      <div className="dashboard-heading"><div><p className="eyebrow">Store sourcing</p><h1>Software-key requests</h1><p>Every public request has a stable reference and stays in this private operations queue.</p></div></div>
      {query.success ? <p className="form-success page-notice">Request updated.</p> : null}
      {query.error ? <p className="form-error page-notice">The request could not be updated.</p> : null}
      <div className="dashboard-stats compact-stats">
        <article><span>New</span><strong>{requests.filter((item) => item.status === "new").length}</strong><small>Not reviewed</small></article>
        <article><span>Reviewing</span><strong>{requests.filter((item) => item.status === "reviewing").length}</strong><small>Terms being checked</small></article>
        <article><span>Quoted</span><strong>{requests.filter((item) => item.status === "quoted").length}</strong><small>Customer contacted</small></article>
        <article><span>Sourced</span><strong>{requests.filter((item) => item.status === "sourced").length}</strong><small>Software located</small></article>
      </div>
      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Private queue</p><h2>Latest requests</h2></div><span className="status-pill subtle">{requests.length}</span></div>
        <div className="request-admin-list">
          {requests.map((request) => (
            <article key={request.id}>
              <div className="request-admin-main"><span className="status-pill">{request.status}</span><strong>{request.software_name} · {request.platform}</strong><span>{request.customer_email} · {request.customer_phone}</span><code>{request.request_reference}</code><small>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small><p>{request.notes || "No optional notes."}</p></div>
              <form action={updateKeyRequest} className="request-resolution-form"><input name="requestId" type="hidden" value={request.id} /><input defaultValue={request.admin_note || ""} maxLength={2000} name="adminNote" placeholder="Internal sourcing note" /><select defaultValue={request.status} name="status"><option value="new">New</option><option value="reviewing">Reviewing</option><option value="quoted">Quoted</option><option value="sourced">Sourced</option><option value="closed">Closed</option></select><button className="button button-dark small" type="submit">Update</button></form>
            </article>
          ))}
          {!requests.length ? <div className="empty-state"><h3>No key requests</h3><p>Public software sourcing requests will appear here.</p></div> : null}
        </div>
      </section>
    </section>
  );
}
