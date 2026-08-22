import { updateMemberStatus } from "@/app/admin/actions";
import { AdminDrawer } from "@/components/admin-drawer";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus, AdminTabs, AdminToolbar } from "@/components/admin-console";
import { AdminInvitationForm } from "@/components/admin-invitations";
import { AdminMemberAccess } from "@/components/admin-member-access";
import { AdminMemberServiceAccess } from "@/components/admin-member-service-access";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member administration" };

export default async function AdminMembersPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; view?: string; search?: string; status?: string; service?: string }>;
}) {
  const query = await searchParams;
  const view = query.view === "invites" ? "invites" : "members";
  const viewer = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [profilesResult, invitationsResult] = supabase
    ? await Promise.all([
        supabase.from("uniplug_profiles").select("user_id,email,display_name,username,phone,role,status,created_at").order("created_at", { ascending: false }).limit(250),
        supabase.from("uniplug_invitations").select("id,email,username,status,action_type,created_at,expires_at").order("created_at", { ascending: false }).limit(100)
      ])
    : [empty, empty];
  const profiles = (profilesResult.data || []) as Array<{
    user_id: string;
    email: string;
    display_name: string | null;
    username: string;
    phone: string | null;
    role: string;
    status: string;
    created_at: string;
  }>;
  const invitations = (invitationsResult.data || []) as Array<{
    id: string;
    email: string;
    username: string;
    status: string;
    action_type: string;
    created_at: string;
    expires_at: string;
  }>;

  const admin = createAdminSupabaseClient();
  const portalRows = admin && profiles.length
    ? ((await admin
        .from("client_portal_accounts")
        .select("user_id,client_id")
        .in("user_id", profiles.map((profile) => profile.user_id))).data || [])
    : [];
  const clientIdByUser = new Map<string, string>(
    (portalRows as Array<{ user_id: string; client_id: string }>).map((row) => [row.user_id, row.client_id] as const)
  );
  const clientIds = [...new Set(Array.from(clientIdByUser.values()))];
  const subscriptionRows = admin && clientIds.length
    ? ((await admin
        .from("client_subscriptions")
        .select("id,client_id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(1000)).data || [])
    : [];
  const subscriptionsByClient = new Map<string, Array<{ id: string; name: string; status: string }>>();
  for (const row of subscriptionRows as unknown as Array<{
    id: string;
    client_id: string;
    status: string;
    metadata: Record<string, unknown> | null;
    service: { name?: string } | Array<{ name?: string }> | null;
  }>) {
    if (row.metadata?.portal_hidden === true) continue;
    const relatedService = Array.isArray(row.service) ? row.service[0] : row.service;
    const current = subscriptionsByClient.get(row.client_id) || [];
    current.push({ id: row.id, name: relatedService?.name || "Digital service", status: row.status });
    subscriptionsByClient.set(row.client_id, current);
  }
  const statusOrder = new Map<string, number>([["active", 0], ["due_soon", 1], ["trial", 2], ["past_due", 3], ["expired", 4], ["cancelled", 5]]);
  for (const subscriptions of subscriptionsByClient.values()) {
    subscriptions.sort((a, b) => (statusOrder.get(a.status) ?? 9) - (statusOrder.get(b.status) ?? 9));
  }

  const serviceNames = [...new Set(Array.from(subscriptionsByClient.values()).flat().map((item) => item.name))].sort();
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all");
  const serviceFilter = String(query.service || "all");
  const filteredProfiles = profiles.filter((profile) => {
    const clientId = clientIdByUser.get(profile.user_id);
    const subscriptions = clientId ? subscriptionsByClient.get(clientId) || [] : [];
    const haystack = `${profile.display_name || ""} ${profile.username} ${profile.email} ${profile.phone || ""} ${subscriptions.map((item) => item.name).join(" ")}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = status === "all" || profile.status === status;
    const matchesService = serviceFilter === "all" || subscriptions.some((item) => item.name === serviceFilter);
    return matchesSearch && matchesStatus && matchesService;
  });

  const inviteAction = (
    <AdminDrawer triggerLabel="Invite member" title="Invite existing client" eyebrow="Member access" description="Find a tracked client and generate their secure portal access without cluttering the directory.">
      <AdminInvitationForm />
    </AdminDrawer>
  );

  return (
    <section className="portal-page">
      <AdminPageHeader
        eyebrow="Members"
        title="Member directory"
        description="Find a client fast, see their services, deliver access and make account changes only when you open them."
        actions={inviteAction}
      />

      {query.success ? <p className="admin-notice">Member access updated.</p> : null}

      <AdminMetricStrip items={[
        { label: "Active", value: profiles.filter((profile) => profile.status === "active").length, detail: "can access member tools", tone: "good" },
        { label: "Pending", value: profiles.filter((profile) => profile.status === "pending").length, detail: "setup incomplete", tone: "warning" },
        { label: "Suspended", value: profiles.filter((profile) => profile.status === "suspended").length, detail: "access restricted", tone: "danger" },
        { label: "Invites", value: invitations.filter((item) => item.status === "pending").length, detail: "active links" }
      ]} />

      <AdminTabs active={view === "invites" ? "/admin/members?view=invites" : "/admin/members"} tabs={[
        { label: "Members", href: "/admin/members", count: profiles.length },
        { label: "Invites", href: "/admin/members?view=invites", count: invitations.length }
      ]} />

      {view === "members" ? (
        <>
          <AdminToolbar>
            <form method="get">
              <input className="admin-search" type="search" name="search" defaultValue={query.search || ""} placeholder="Search name, phone, username or email…" />
              <select name="status" defaultValue={status}><option value="all">All access</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select>
              <select name="service" defaultValue={serviceFilter}><option value="all">All services</option>{serviceNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>
              <button className="button button-light" type="submit">Filter</button>
            </form>
          </AdminToolbar>

          <AdminSection title="Members" description={`${filteredProfiles.length} matching profile${filteredProfiles.length === 1 ? "" : "s"}`}>
            {filteredProfiles.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Member</th><th>Contact</th><th>Services</th><th>Access</th><th>Joined</th><th>Manage</th></tr></thead>
                  <tbody>
                    {filteredProfiles.map((profile) => {
                      const clientId = clientIdByUser.get(profile.user_id);
                      const deliverySubscriptions = clientId ? subscriptionsByClient.get(clientId) || [] : [];
                      return (
                        <tr key={profile.user_id}>
                          <td><strong>{profile.display_name || `@${profile.username}`}</strong><small>@{profile.username}</small></td>
                          <td><strong>{profile.phone || profile.email}</strong><small>{profile.phone ? profile.email : "No phone saved"}</small></td>
                          <td><strong>{deliverySubscriptions.length}</strong><small>{deliverySubscriptions.length ? deliverySubscriptions.slice(0, 2).map((item) => item.name).join(" · ") : "No tracked service"}{deliverySubscriptions.length > 2 ? ` +${deliverySubscriptions.length - 2}` : ""}</small></td>
                          <td><AdminStatus value={profile.status} /></td>
                          <td>{new Date(profile.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</td>
                          <td>
                            <AdminDrawer triggerLabel="Manage" triggerClassName="button button-light small" title={profile.display_name || `@${profile.username}`} eyebrow="Member" description={`@${profile.username} · ${deliverySubscriptions.length} tracked service${deliverySubscriptions.length === 1 ? "" : "s"}`}>
                              <div className="admin-stack">
                                <dl className="admin-detail-grid">
                                  <div><dt>Email</dt><dd>{profile.email}</dd></div>
                                  <div><dt>Phone</dt><dd>{profile.phone || "Not saved"}</dd></div>
                                  <div><dt>Role</dt><dd>{profile.role}</dd></div>
                                  <div><dt>Joined</dt><dd>{new Date(profile.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
                                </dl>
                                <div className="admin-compact-card"><strong>Deliver portal access</strong><p>Create or copy the member's secure access link and login message.</p><div style={{ marginTop: 10 }}><AdminMemberAccess userId={profile.user_id} status={profile.status} subscriptions={deliverySubscriptions} /></div></div>
                                <div className="admin-compact-card"><strong>Service visibility</strong><p>Control which tracked services are available in this member's portal.</p><div style={{ marginTop: 10 }}><AdminMemberServiceAccess subscriptions={deliverySubscriptions} /></div></div>
                                <div className="admin-compact-card">
                                  <strong>Portal status</strong>
                                  <p>Suspend or restore access. Changes take effect immediately.</p>
                                  <form action={updateMemberStatus} className="admin-form-clean" style={{ marginTop: 10 }}>
                                    <input name="userId" type="hidden" value={profile.user_id} />
                                    <label>Access status<select name="status" defaultValue={profile.status} disabled={profile.user_id === viewer.user.id}><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></label>
                                    <ConfirmSubmitButton className="button button-dark small" confirmation={`Change access status for @${profile.username}? This takes effect immediately.`} disabled={profile.user_id === viewer.user.id}>Save access</ConfirmSubmitButton>
                                  </form>
                                </div>
                              </div>
                            </AdminDrawer>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <AdminEmptyState title="No members match" description="Clear the filters or invite an existing tracked client." />}
          </AdminSection>
        </>
      ) : (
        <AdminSection title="Invitation history" description="Recent invite and recovery links. Expired links remain here for audit context.">
          {invitations.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Member</th><th>Email</th><th>Action</th><th>Created</th><th>Expires</th><th>Status</th></tr></thead>
                <tbody>{invitations.map((invitation) => <tr key={invitation.id}><td><strong>@{invitation.username}</strong></td><td>{invitation.email}</td><td>{invitation.action_type.replaceAll("_", " ")}</td><td>{new Date(invitation.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td><td>{new Date(invitation.expires_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td><td><AdminStatus value={invitation.status} /></td></tr>)}</tbody>
              </table>
            </div>
          ) : <AdminEmptyState title="No invitations yet" description="Use Invite member to create the first secure client access link." />}
        </AdminSection>
      )}
    </section>
  );
}
