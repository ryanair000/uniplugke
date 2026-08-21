import { updateMemberStatus } from "@/app/admin/actions";
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
  searchParams: Promise<{ success?: string }>;
}) {
  const query = await searchParams;
  const viewer = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const empty = { data: [] as Array<Record<string, unknown>> };
  const [profilesResult, invitationsResult] = supabase
    ? await Promise.all([
        supabase.from("uniplug_profiles").select("user_id,email,display_name,username,phone,role,status,created_at").order("created_at", { ascending: false }).limit(250),
        supabase.from("uniplug_invitations").select("id,email,username,status,action_type,created_at,expires_at").order("created_at", { ascending: false }).limit(30)
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

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">Access operations</p><h1>Members</h1><p>Invite customers, deliver secure VIP access, verify account state, and suspend access without exposing private credentials.</p></div>
      </div>
      {query.success ? <p className="form-success page-notice">Member status updated.</p> : null}

      <div className="dashboard-stats compact-stats">
        <article><span>Active</span><strong>{profiles.filter((profile) => profile.status === "active").length}</strong><small>Can access member tools</small></article>
        <article><span>Pending</span><strong>{profiles.filter((profile) => profile.status === "pending").length}</strong><small>Setup not completed</small></article>
        <article><span>Suspended</span><strong>{profiles.filter((profile) => profile.status === "suspended").length}</strong><small>Access restricted</small></article>
      </div>

      <div className="admin-grid admin-members-grid">
        <AdminInvitationForm />
        <section className="panel">
          <div className="section-heading compact"><div><p className="eyebrow">Invitation log</p><h2>Recent links</h2></div></div>
          <div className="admin-list">
            {invitations.slice(0, 8).map((invitation) => (
              <div key={invitation.id}>
                <div><strong>@{invitation.username}</strong><span>{invitation.email} · {invitation.action_type}</span><span>Expires {new Date(invitation.expires_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                <span className={`status-pill status-${invitation.status}`}>{invitation.status}</span>
              </div>
            ))}
            {!invitations.length ? <p className="muted-copy">No invitations created yet.</p> : null}
          </div>
        </section>
      </div>

      <section className="panel portal-table-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Directory</p><h2>All members</h2></div><span className="status-pill subtle">{profiles.length} profiles</span></div>
        <div className="member-admin-list">
          {profiles.map((profile) => {
            const clientId = clientIdByUser.get(profile.user_id);
            const deliverySubscriptions = clientId ? subscriptionsByClient.get(clientId) || [] : [];
            return (
              <article key={profile.user_id}>
                <div>
                  <strong>{profile.display_name || `@${profile.username}`}</strong>
                  <span>@{profile.username} · {profile.email}</span>
                  <span>{profile.phone || "No phone"} · {profile.role} · joined {new Date(profile.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
                </div>
                <div>
                  <AdminMemberAccess
                    userId={profile.user_id}
                    status={profile.status}
                    subscriptions={deliverySubscriptions}
                  />
                  <AdminMemberServiceAccess subscriptions={deliverySubscriptions} />
                  <form action={updateMemberStatus}>
                    <input name="userId" type="hidden" value={profile.user_id} />
                    <label className="sr-only" htmlFor={`status-${profile.user_id}`}>
                      Access status for @{profile.username}
                    </label>
                    <select
                      id={`status-${profile.user_id}`}
                      name="status"
                      defaultValue={profile.status}
                      disabled={profile.user_id === viewer.user.id}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <ConfirmSubmitButton
                      className="button button-light small"
                      confirmation={`Change access status for @${profile.username}? This takes effect immediately.`}
                      disabled={profile.user_id === viewer.user.id}
                    >
                      Update
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </article>
            );
          })}
          {!profiles.length ? <div className="empty-state"><h3>No profiles found</h3><p>Create the first member invitation above.</p></div> : null}
        </div>
      </section>
    </section>
  );
}
