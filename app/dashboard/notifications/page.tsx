import Link from "next/link";
import { requireMember } from "@/lib/auth";
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

function notificationHref(notification: Notification) {
  if (notification.entity_type === "order" && notification.entity_id) {
    return `/dashboard/orders/${notification.entity_id}`;
  }
  if (notification.entity_type === "subscription" && notification.entity_id) {
    return `/dashboard/subscriptions/${notification.entity_id}`;
  }
  if (notification.entity_type === "support_ticket" && notification.entity_id) {
    return `/dashboard/support/${notification.entity_id}`;
  }
  if (notification.entity_type === "request") return "/dashboard/support";
  if (notification.entity_type === "profile") return "/dashboard/settings";
  return null;
}

export default async function NotificationsPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase
        .from("uniplug_member_events")
        .select("id,title,detail,entity_type,entity_id,created_at")
        .eq("user_id", viewer.user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const notifications = (data || []) as Notification[];

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Notifications</h1>
          <p>Password reminders, service updates, orders, and support activity appear here.</p>
        </div>
      </div>

      <section className="panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">Latest</p><h2>Account updates</h2></div>
        </div>
        <div className="activity-list">
          {notifications.map((notification) => {
            const href = notificationHref(notification);
            return (
              <article key={notification.id}>
                <span className="activity-dot" aria-hidden="true" />
                <div>
                  <strong>{notification.title}</strong>
                  {notification.detail ? <p>{notification.detail}</p> : null}
                  <small>{new Date(notification.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</small>
                  {href ? <p><Link className="wallet-text-link" href={href}>View details →</Link></p> : null}
                </div>
              </article>
            );
          })}
          {!notifications.length ? <p className="muted-copy">You do not have any notifications yet.</p> : null}
        </div>
      </section>
    </section>
  );
}
