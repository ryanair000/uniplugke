import Link from "next/link";
import { AccountAccess } from "@/components/account-access";
import type { TrackedSubscription } from "@/lib/client-portal";
import { formatDualPrice, formatUsd } from "@/lib/currency";

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function renewalLabel(subscription: TrackedSubscription) {
  const date = subscription.nextRenewalDate || subscription.endDate;
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "Not scheduled";
}

function money(subscription: TrackedSubscription) {
  return subscription.currency === "USD"
    ? formatUsd(subscription.amount)
    : formatDualPrice(subscription.amount);
}

function TrackedList({ subscriptions }: { subscriptions: TrackedSubscription[] }) {
  return subscriptions.length ? (
    <div className="subscription-list">
      {subscriptions.map((subscription) => (
        <Link className="subscription-row" href={`/dashboard/subscriptions/${subscription.id}`} key={subscription.id}>
          <span className="service-logo small tracked-logo">{subscription.service?.name.slice(0, 2).toUpperCase() || "UP"}</span>
          <div>
            <strong>{subscription.service?.name || subscription.serviceIdentifier || "Tracked service"}</strong>
            <span>{subscription.billingCycle} · {money(subscription)}</span>
          </div>
          <span className={`status-pill status-${subscription.status}`}>{statusLabel(subscription.status)}</span>
          <span>Renews {renewalLabel(subscription)}</span>
          <b aria-hidden="true">→</b>
        </Link>
      ))}
    </div>
  ) : (
    <div className="empty-state"><h3>No tracked services</h3><p>Ask UniPlug support to connect services already managed for you.</p></div>
  );
}

export function TrackedClientDashboard({ name, subscriptions }: { name: string; subscriptions: TrackedSubscription[] }) {
  const active = subscriptions.filter((item) => ["active", "due_soon", "trial"].includes(item.status));
  const next = [...active].filter((item) => item.nextRenewalDate || item.endDate).sort((a, b) => renewalLabel(a).localeCompare(renewalLabel(b)))[0];
  return (
    <section className="section shell page-top">
      <div className="dashboard-heading"><div><p className="eyebrow">My UniPlug</p><h1>Hello, {name}.</h1><p>Your Lokimax services, renewal dates, secure access, and instant replacements are connected here.</p></div><div className="dashboard-heading-actions"><Link className="button button-light" href="/dashboard/settings">Account settings</Link></div></div>
      <div className="dashboard-stats">
        <article><span>Active services</span><strong>{active.length}</strong><small>{subscriptions.length} total tracked</small></article>
        <article><span>Instant replacement</span><strong>Ready</strong><small>Up to 3 per service every 7 days</small></article>
        <article><span>Next renewal</span><strong>{next ? renewalLabel(next) : "—"}</strong><small>{next?.service?.name || "No renewal scheduled"}</small></article>
      </div>
      <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">My services</p><h2>Tracked subscriptions</h2></div><Link href="/dashboard/subscriptions">View all →</Link></div><TrackedList subscriptions={subscriptions} /></section>
    </section>
  );
}

export function TrackedSubscriptionsPage({ subscriptions }: { subscriptions: TrackedSubscription[] }) {
  return (
    <section className="section shell page-top portal-page">
      <div className="dashboard-heading"><div><p className="eyebrow">My UniPlug</p><h1>Subscriptions</h1><p>Every service already tracked by Lokimax, with renewal and access status.</p></div></div>
      <div className="dashboard-stats compact-stats">
        <article><span>All services</span><strong>{subscriptions.length}</strong><small>Connected to your client record</small></article>
        <article><span>Active</span><strong>{subscriptions.filter((item) => ["active", "due_soon", "trial"].includes(item.status)).length}</strong><small>Available for use</small></article>
        <article><span>Replacement ready</span><strong>{subscriptions.filter((item) => item.hasAssignedAccount).length}</strong><small>Services with assigned access</small></article>
      </div>
      <section className="panel portal-table-panel"><div className="section-heading compact"><div><p className="eyebrow">Service library</p><h2>All tracked subscriptions</h2></div></div><TrackedList subscriptions={subscriptions} /></section>
    </section>
  );
}

export function TrackedSubscriptionDetail({ subscription }: { subscription: TrackedSubscription }) {
  const active = ["active", "due_soon", "trial"].includes(subscription.status);
  return (
    <section className="section shell page-top">
      <Link className="back-link" href="/dashboard/subscriptions">← Back to subscriptions</Link>
      <div className="subscription-detail-hero">
        <span className="service-logo detail-service-logo tracked-logo">{subscription.service?.name.slice(0, 2).toUpperCase() || "UP"}</span>
        <div><p className="eyebrow">Tracked service</p><h1>{subscription.service?.name || subscription.serviceIdentifier || "Service"}</h1><p>{subscription.service?.description || "Managed through your Lokimax client account."}</p><div className="tag-row"><span>{subscription.billingCycle}</span><span>{statusLabel(subscription.status)}</span></div></div>
      </div>
      <div className="subscription-detail-grid">
        <div className="detail-main"><section className="panel"><p className="eyebrow">Subscription</p><h2>Service details</h2><dl className="detail-list"><div><dt>Status</dt><dd>{statusLabel(subscription.status)}</dd></div><div><dt>Amount</dt><dd>{money(subscription)}</dd></div><div><dt>Started</dt><dd>{subscription.startDate || "Not recorded"}</dd></div><div><dt>Next renewal</dt><dd>{renewalLabel(subscription)}</dd></div><div><dt>Auto-renew</dt><dd>{subscription.autoRenew ? "Enabled" : "Manual"}</dd></div></dl></section></div>
        <aside className="subscription-actions-column"><AccountAccess subscriptionId={subscription.id} canReplace={active} /><section className="panel support-card"><p className="eyebrow">Support</p><h2>Still need help?</h2><p>If no replacement inventory is available, contact the UniPlug team for manual assistance.</p><a className="button button-light" href={`https://wa.me/254113033475?text=${encodeURIComponent(`Hello UniPlug, I need help with ${subscription.service?.name || "my service"}.`)}`}>Contact support</a></section></aside>
      </div>
    </section>
  );
}
