import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My UniPlug" };

export default async function DashboardPage() {
  const viewer = await requireMember();
  const supabase = await createServerSupabaseClient();
  const { data: subscriptions } = supabase ? await supabase.from("uniplug_member_subscriptions").select("id,status,current_period_end,service:uniplug_catalog_services(name,logo_text,accent_color),plan:uniplug_member_plans(plan_name)").eq("user_id", viewer.user.id).order("current_period_end") : { data: [] };
  const items = (subscriptions ?? []) as unknown as Array<{ id: string; status: string; current_period_end: string | null; service: { name: string; logo_text: string; accent_color: string } | null; plan: { plan_name: string } | null }>;

  return <section className="section shell page-top"><div className="dashboard-heading"><div><p className="eyebrow">My UniPlug</p><h1>Hello, {viewer.profile.displayName || viewer.profile.username}.</h1><p>Your services, activation status, and renewal dates live here.</p></div><Link className="button button-dark" href="/services">Browse services</Link></div><div className="dashboard-stats"><article><span>Active services</span><strong>{items.filter((item) => item.status === "active").length}</strong></article><article><span>Open issues</span><strong>0</strong><small>Issue reporting arrives in Phase 5</small></article><article><span>Next renewal</span><strong>{items.find((item) => item.current_period_end)?.current_period_end ? new Date(items.find((item) => item.current_period_end)!.current_period_end!).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"}</strong></article></div><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">My services</p><h2>Subscriptions</h2></div></div>{items.length ? <div className="subscription-list">{items.map((item) => <article key={item.id}><div className="service-logo small" style={{ background: item.service?.accent_color || "#6957ff" }}>{item.service?.logo_text || "UP"}</div><div><strong>{item.service?.name || "Digital service"}</strong><span>{item.plan?.plan_name || "Member plan"}</span></div><span className="status-pill">{item.status}</span><span>{item.current_period_end ? `Renews ${new Date(item.current_period_end).toLocaleDateString("en-KE", { dateStyle: "medium" })}` : "Activation pending"}</span></article>)}</div> : <div className="empty-state"><h3>No services yet</h3><p>Member purchases and admin-assigned services will appear here.</p><Link className="button button-dark" href="/services">Explore the catalog</Link></div>}</section></section>;
}
