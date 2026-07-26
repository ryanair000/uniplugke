import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account activity" };

export default async function ActivityPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const { data } = supabase
    ? await supabase
        .from("uniplug_member_events")
        .select("id,event_type,title,detail,entity_type,entity_id,created_at")
        .eq("user_id", viewer.user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const events = (data || []) as Array<{
    id: string;
    event_type: string;
    title: string;
    detail: string | null;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
  }>;

  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">My UniPlug</p>
          <h1>Account activity</h1>
          <p>A clear record of purchases, activations, renewals, and support decisions.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-light" href="/help">Get help</Link>
        </div>
      </div>

      <section className="panel activity-panel">
        <div className="section-heading compact">
          <div><p className="eyebrow">Timeline</p><h2>Latest updates</h2></div>
          <span className="status-pill subtle">{events.length} event{events.length === 1 ? "" : "s"}</span>
        </div>
        <div className="activity-list activity-list-full">
          {events.map((event) => (
            <article key={event.id}>
              <span className="activity-dot" aria-hidden="true" />
              <div>
                <div className="activity-title-row">
                  <strong>{event.title}</strong>
                  <span>{event.event_type.replaceAll("_", " ")}</span>
                </div>
                {event.detail ? <p>{event.detail}</p> : null}
                <small>{new Date(event.created_at).toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short" })}</small>
              </div>
            </article>
          ))}
          {!events.length ? (
            <div className="empty-state">
              <h3>No activity yet</h3>
              <p>Account and service updates will appear here as they happen.</p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
