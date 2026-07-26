import { updateMemberStatus } from "@/app/admin/actions";
import { AdminInvitationForm } from "@/components/admin-invitations";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div><p className="eyebrow">Access operations</p><h1>Members</h1><p>Invite customers, verify account state, and suspend access without exposing private credentials.</p></div>
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
          {profiles.map((profile) => (
            <article key={profile.user_id}>
              <div>
                <strong>{profile.display_name || `@${profile.username}`}</strong>
                <span>@{profile.username} · {profile.email}</span>
                <span>{profile.phone || "No phone"} · {profile.role} · joined {new Date(profile.created_at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
              </div>
              <form action={updateMemberStatus}>
                <input name="userId" type="hidden" value={profile.user_id} />
                <select name="status" defaultValue={profile.status} disabled={profile.user_id === viewer.user.id}>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
                <button className="button button-light small" disabled={profile.user_id === viewer.user.id}>Update</button>
              </form>
            </article>
          ))}
          {!profiles.length ? <div className="empty-state"><h3>No profiles found</h3><p>Create the first member invitation above.</p></div> : null}
        </div>
      </section>
    </section>
  );
}
