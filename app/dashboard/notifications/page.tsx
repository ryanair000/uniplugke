import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatMemberDateTime, memberEventHref } from "@/lib/member-dashboard";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

type Notification = {
  id: string;
  title: string;
  detail: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export default async function NotificationsPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const result = supabase
    ? await supabase
        .from("uniplug_member_events")
        .select("id,title,detail,entity_type,entity_id,created_at")
        .eq("user_id", viewer.user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : null;
  const notifications = (result?.data || []) as Notification[];
  const unavailable = !supabase || Boolean(result?.error);

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Notifications</h1>
          <p>Password reminders, service updates, orders, and support activity appear here.</p>
        </div>
      </div>

      {unavailable ? <p className="form-error page-notice">Notifications could not be loaded. Refresh this page to try again.</p> : null}

      <section className="panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">Latest</p><h2>Account updates</h2></div>
        </div>
        {unavailable ? <div className="empty-state"><h3>We could not load your notifications</h3><p>Refresh this page to try again.</p><Link className="button button-light" href="/dashboard/notifications">Retry</Link></div> : <div className="activity-list">
          {notifications.map((notification) => {
            const href = memberEventHref(notification.entity_type, notification.entity_id);
            return (
              <article key={notification.id}>
                <span className="activity-dot" aria-hidden="true" />
                <div>
                  <strong>{notification.title}</strong>
                  {notification.detail ? <p>{notification.detail}</p> : null}
                  <small>{formatMemberDateTime(notification.created_at)}</small>
                  {href ? <p><Link className="wallet-text-link" href={href}>View details →</Link></p> : null}
                </div>
              </article>
            );
          })}
          {!notifications.length ? <p className="muted-copy">You do not have any notifications yet.</p> : null}
        </div>}
      </section>
    </section>
  );
}
