import Link from "next/link";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminTabs, AdminToolbar } from "@/components/admin-console";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Slot operations" };

type Slot = {
  id: string;
  account: string | null;
  status: string;
  expiry_date: string | null;
  service_id: string | null;
};

type LegacyService = { id: string; service_name: string | null };
type Client = { id: string; display_name: string | null; email: string | null; phone: string | null };
type Portal = { user_id: string; client_id: string };
type Subscription = {
  id: string;
  client_id: string;
  status: string;
  account_reference: string | null;
  next_renewal_date: string | null;
  metadata: Record<string, unknown> | null;
  service: { name?: string } | Array<{ name?: string }> | null;
};
type Replacement = {
  id: string;
  user_id: string;
  service_name: string;
  reason: string;
  status: string;
  created_at: string;
};

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] || null : value;
}

function metadataId(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function currentTimeMs() {
  return Date.now();
}

export default async function AdminSlotsPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; search?: string; service?: string }>;
}) {
  const query = await searchParams;
  const validViews = new Set(["all", "available", "assigned", "replacements", "attention"]);
  const view = validViews.has(String(query.view || "all")) ? String(query.view || "all") : "all";
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");

  const [slotResult, serviceResult, subscriptionResult, clientResult, portalResult, replacementResult] = await Promise.all([
    admin.from("slots").select("id,account,status,expiry_date,service_id").order("expiry_date", { ascending: true }).limit(1000),
    admin.from("services").select("id,service_name").limit(500),
    admin.from("client_subscriptions").select("id,client_id,status,account_reference,next_renewal_date,metadata,service:client_services!client_subscriptions_service_id_fkey(name)").order("updated_at", { ascending: false }).limit(2000),
    admin.from("clients").select("id,display_name,email,phone").limit(2000),
    admin.from("client_portal_accounts").select("user_id,client_id").limit(2000),
    admin.from("uniplug_replacement_approvals").select("id,user_id,service_name,reason,status,created_at").order("created_at", { ascending: false }).limit(200)
  ]);

  const loadError = slotResult.error || serviceResult.error || subscriptionResult.error || clientResult.error || portalResult.error || replacementResult.error;
  if (loadError) throw new Error(`Slot operations could not be loaded: ${loadError.message}`);

  const slots = (slotResult.data || []) as Slot[];
  const legacyServices = (serviceResult.data || []) as LegacyService[];
  const subscriptions = ((subscriptionResult.data || []) as unknown as Subscription[]).filter((item) => item.metadata?.portal_hidden !== true);
  const clients = (clientResult.data || []) as Client[];
  const portals = (portalResult.data || []) as Portal[];
  const replacements = (replacementResult.data || []) as Replacement[];

  const serviceById = new Map(legacyServices.map((item) => [item.id, item.service_name || "Digital service"]));
  const clientById = new Map(clients.map((item) => [item.id, item]));
  const clientIdByUser = new Map(portals.map((item) => [item.user_id, item.client_id]));
  const assignedBySlot = new Map<string, Subscription>();
  for (const subscription of subscriptions) {
    const slotId = metadataId(subscription.metadata, "assigned_slot_id");
    if (slotId && !assignedBySlot.has(slotId)) assignedBySlot.set(slotId, subscription);
  }

  const now = currentTimeMs();
  const rows = slots.map((slot) => {
    const subscription = assignedBySlot.get(slot.id) || null;
    const client = subscription ? clientById.get(subscription.client_id) || null : null;
    const serviceName = serviceById.get(slot.service_id || "") || relation(subscription?.service || null)?.name || "Digital service";
    const isAssigned = Boolean(subscription);
    const expired = slot.expiry_date ? new Date(slot.expiry_date).getTime() < now : false;
    const needsAttention = isAssigned && (expired || ["expired", "inactive", "blocked", "failed"].includes(normalize(slot.status)));
    return { slot, subscription, client, serviceName, isAssigned, needsAttention };
  });

  const availableRows = rows.filter((row) => !row.isAssigned && !["expired", "inactive", "blocked"].includes(normalize(row.slot.status)));
  const assignedRows = rows.filter((row) => row.isAssigned);
  const attentionRows = rows.filter((row) => row.needsAttention);
  const pendingReplacements = replacements.filter((item) => item.status === "pending");
  const serviceNames = [...new Set(rows.map((row) => row.serviceName))].sort();
  const search = normalize(query.search);
  const serviceFilter = String(query.service || "all");

  const baseRows = view === "available" ? availableRows : view === "assigned" ? assignedRows : view === "attention" ? attentionRows : rows;
  const filteredRows = baseRows.filter((row) => {
    const haystack = normalize(`${row.serviceName} ${row.slot.account || ""} ${row.client?.display_name || ""} ${row.client?.email || ""} ${row.subscription?.account_reference || ""}`);
    return (!search || haystack.includes(search)) && (serviceFilter === "all" || row.serviceName === serviceFilter);
  });

  const activeHref = view === "all" ? "/admin/slots" : `/admin/slots?view=${view}`;

  return (
    <section className="portal-page">
      <AdminPageHeader eyebrow="Slots" title="Slot operations" description="See account capacity, assignments and replacement pressure without mixing operational slot expiry with a client's own renewal date." />

      <AdminMetricStrip items={[
        { label: "Total slots", value: slots.length, detail: "operational inventory" },
        { label: "Available", value: availableRows.length, detail: "ready to assign", tone: "good" },
        { label: "Assigned", value: assignedRows.length, detail: "linked to members" },
        { label: "Needs attention", value: attentionRows.length + pendingReplacements.length, detail: `${pendingReplacements.length} replacement request${pendingReplacements.length === 1 ? "" : "s"}`, tone: attentionRows.length + pendingReplacements.length ? "warning" : "good" }
      ]} />

      <AdminTabs active={activeHref} tabs={[
        { label: "All", href: "/admin/slots", count: rows.length },
        { label: "Available", href: "/admin/slots?view=available", count: availableRows.length },
        { label: "Assigned", href: "/admin/slots?view=assigned", count: assignedRows.length },
        { label: "Replacements", href: "/admin/slots?view=replacements", count: pendingReplacements.length },
        { label: "Attention", href: "/admin/slots?view=attention", count: attentionRows.length }
      ]} />

      {view === "replacements" ? (
        <AdminSection title="Replacement queue" description="Members waiting for an account or slot change. Approval remains separate from the customer's paid renewal.">
          {pendingReplacements.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Member</th><th>Service</th><th>Current assignment</th><th>Available slots</th><th>Reason</th><th>Requested</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingReplacements.map((request) => {
                    const clientId = clientIdByUser.get(request.user_id);
                    const client = clientId ? clientById.get(clientId) : null;
                    const matchingSubscription = clientId ? subscriptions.find((item) => item.client_id === clientId && normalize(relation(item.service)?.name) === normalize(request.service_name)) : null;
                    const currentSlotId = matchingSubscription ? metadataId(matchingSubscription.metadata, "assigned_slot_id") : null;
                    const currentSlot = currentSlotId ? rows.find((row) => row.slot.id === currentSlotId) : null;
                    const candidates = availableRows.filter((row) => normalize(row.serviceName) === normalize(request.service_name));
                    return (
                      <tr key={request.id}>
                        <td><strong>{client?.display_name || client?.email || `Member ${request.user_id.slice(0, 8)}`}</strong><small>{client?.phone || client?.email || "Portal member"}</small></td>
                        <td><strong>{request.service_name}</strong></td>
                        <td>{currentSlot ? <><strong>{currentSlot.slot.account || matchingSubscription?.account_reference || "Account"}</strong><small>Slot {currentSlot.slot.id.slice(0, 8)} · expires {currentSlot.slot.expiry_date ? new Date(currentSlot.slot.expiry_date).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "not set"}</small></> : <span className="admin-row-subtext">No slot matched</span>}</td>
                        <td><strong>{candidates.length}</strong><small>{candidates.length ? candidates.slice(0, 2).map((item) => item.slot.account || item.slot.id.slice(0, 8)).join(" · ") : "No matching free slot"}</small></td>
                        <td>{request.reason.replaceAll("_", " ")}</td>
                        <td>{new Date(request.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td>
                        <td><Link className="button button-light small" href="/admin/requests?view=replacements">Review</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <AdminEmptyState title="No replacement queue" description="New approved-account replacement requests will appear here automatically." />}
        </AdminSection>
      ) : (
        <>
          <AdminToolbar>
            <form method="get">
              {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
              <input className="admin-search" type="search" name="search" defaultValue={query.search || ""} placeholder="Search account, member or service…" />
              <select name="service" defaultValue={serviceFilter}><option value="all">All services</option>{serviceNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>
              <button className="button button-light" type="submit">Filter</button>
            </form>
          </AdminToolbar>
          <AdminSection title={view === "available" ? "Available slots" : view === "assigned" ? "Assigned slots" : view === "attention" ? "Slots needing attention" : "All slots"} description={`${filteredRows.length} matching slot${filteredRows.length === 1 ? "" : "s"}`}>
            {filteredRows.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Service</th><th>Account / slot</th><th>Member</th><th>Client renewal</th><th>Slot expiry</th><th>State</th></tr></thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.slot.id}>
                        <td><strong>{row.serviceName}</strong></td>
                        <td><strong>{row.slot.account || row.subscription?.account_reference || "Unlabelled account"}</strong><small>Slot {row.slot.id.slice(0, 8)}</small></td>
                        <td>{row.client ? <><strong>{row.client.display_name || row.client.email || "Member"}</strong><small>{row.client.phone || row.client.email || ""}</small></> : <span className="admin-row-subtext">Unassigned</span>}</td>
                        <td>{row.subscription?.next_renewal_date ? <><strong>{new Date(row.subscription.next_renewal_date).toLocaleDateString("en-KE", { dateStyle: "medium" })}</strong><small>customer subscription</small></> : <span className="admin-row-subtext">—</span>}</td>
                        <td>{row.slot.expiry_date ? <><strong>{new Date(row.slot.expiry_date).toLocaleDateString("en-KE", { dateStyle: "medium" })}</strong><small>account pool metadata</small></> : <span className="admin-row-subtext">Not set</span>}</td>
                        <td><AdminStatus value={row.needsAttention ? "attention" : row.isAssigned ? "assigned" : "available"} label={row.needsAttention ? "Attention" : row.isAssigned ? "Assigned" : "Available"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <AdminEmptyState title="No slots match" description="Clear the filters or switch to another slot view." />}
          </AdminSection>
        </>
      )}
    </section>
  );
}
