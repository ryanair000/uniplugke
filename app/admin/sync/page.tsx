import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus } from "@/components/admin-console";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "LokiMax sync health" };

export default async function AdminSyncPage() {
  await requireAdmin();
  const admin = createAdminSupabaseClient();

  if (!admin) {
    return (
      <section className="portal-page">
        <AdminPageHeader eyebrow="Integrations" title="LokiMax sync health" description="Shared client identity and subscription synchronization." />
        <AdminEmptyState title="Admin database client unavailable" description="Check the Supabase service-role configuration for this deployment." />
      </section>
    );
  }

  const [clientsResult, portalsResult, aliasesResult, eventsResult] = await Promise.all([
    admin
      .from("clients")
      .select("id,display_name,phone_e164,portal_access_status,portal_sync_error,portal_sync_updated_at,deleted_at")
      .is("deleted_at", null),
    admin.from("client_portal_accounts").select("user_id,client_id,updated_at"),
    admin.from("client_identity_aliases").select("alias_client_id,canonical_client_id,reason,confidence,created_at"),
    admin
      .from("integration_sync_events")
      .select("id,entity_id,event_type,status,error,retry_count,metadata,created_at,processed_at")
      .order("created_at", { ascending: false })
      .limit(80)
  ]);

  const clients = (clientsResult.data || []) as Array<{
    id: string;
    display_name: string;
    phone_e164: string | null;
    portal_access_status: string;
    portal_sync_error: string | null;
    portal_sync_updated_at: string | null;
    deleted_at: string | null;
  }>;
  const portals = (portalsResult.data || []) as Array<{ user_id: string; client_id: string; updated_at: string }>;
  const aliases = (aliasesResult.data || []) as Array<{ alias_client_id: string; canonical_client_id: string; reason: string; confidence: number; created_at: string }>;
  const events = (eventsResult.data || []) as Array<{
    id: number;
    entity_id: string | null;
    event_type: string;
    status: string;
    error: string | null;
    retry_count: number;
    metadata: Record<string, unknown> | null;
    created_at: string;
    processed_at: string | null;
  }>;

  const aliasIds = new Set(aliases.map((item) => item.alias_client_id));
  const canonicalClients = clients.filter((client) => !aliasIds.has(client.id));
  const activePortalClients = canonicalClients.filter((client) => client.portal_access_status === "active");
  const syncErrors = canonicalClients.filter((client) => client.portal_access_status === "error" || Boolean(client.portal_sync_error));
  const orphanPortalRows = portals.filter((portal) => aliasIds.has(portal.client_id));
  const recentFailures = events.filter((event) => event.status === "failed" || event.status === "dead_letter");

  return (
    <section className="portal-page">
      <AdminPageHeader
        eyebrow="Integrations"
        title="LokiMax sync health"
        description="One client identity across LokiMax billing and the UniPlug member portal. Failures stay visible here instead of silently drifting."
      />

      <AdminMetricStrip items={[
        { label: "Canonical clients", value: canonicalClients.length, detail: "deduplicated identities" },
        { label: "Portal active", value: activePortalClients.length, detail: "linked UniPlug members", tone: "good" },
        { label: "Identity aliases", value: aliases.length, detail: "duplicate rows resolved" },
        { label: "Sync issues", value: syncErrors.length + orphanPortalRows.length, detail: "needs admin attention", tone: syncErrors.length + orphanPortalRows.length ? "danger" : "good" }
      ]} />

      <AdminSection title="Current issues" description="Canonical client errors and any portal mappings still attached to an alias identity.">
        {syncErrors.length || orphanPortalRows.length ? (
          <div className="admin-list">
            {syncErrors.slice(0, 30).map((client) => (
              <div key={`client-${client.id}`}>
                <div>
                  <strong>{client.display_name}</strong>
                  <span>{client.phone_e164 || client.id} · {client.portal_sync_error || "Portal synchronization failed"}</span>
                </div>
                <AdminStatus value="error" />
              </div>
            ))}
            {orphanPortalRows.slice(0, 30).map((portal) => (
              <div key={`portal-${portal.user_id}`}>
                <div>
                  <strong>Portal mapping needs canonical relink</strong>
                  <span>Client {portal.client_id.slice(0, 8)} · User {portal.user_id.slice(0, 8)}</span>
                </div>
                <AdminStatus value="warning" />
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState title="Sync is healthy" description="No canonical client errors or alias-linked portal accounts are currently detected." />
        )}
      </AdminSection>

      <AdminSection title="Recent synchronization events" description="Latest LokiMax → UniPlug identity and portal operations.">
        {events.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Event</th><th>Client</th><th>Status</th><th>Created</th><th>Details</th></tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td><strong>{event.event_type.replaceAll("_", " ")}</strong></td>
                    <td>{event.entity_id ? event.entity_id.slice(0, 8) : "—"}</td>
                    <td><AdminStatus value={event.status} /></td>
                    <td>{new Date(event.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td><small>{event.error || (event.processed_at ? "Completed" : `Retries: ${event.retry_count}`)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No sync events yet" description="Identity reconciliation and portal provisioning events will appear here." />
        )}
      </AdminSection>

      {recentFailures.length ? (
        <p className="admin-notice">{recentFailures.length} recent failed sync event{recentFailures.length === 1 ? "" : "s"} remain in the audit trail.</p>
      ) : null}
    </section>
  );
}
