import Link from "next/link";
import { AccountAccess } from "@/components/account-access";
import { ServiceArtwork } from "@/components/service-artwork";
import type { TrackedSubscription } from "@/lib/client-portal";
import { formatDualPrice, formatUsd } from "@/lib/currency";
import { lokimaxServiceDisplayName } from "@/lib/lokimax-services";

function statusLabel(status: string) {
  if (status === "due_soon") return "Renewal due soon";
  return status.replaceAll("_", " ");
}

function serviceName(subscription: TrackedSubscription) {
  return lokimaxServiceDisplayName(subscription.service?.name || subscription.serviceIdentifier || "Digital service");
}

function serviceDescription(subscription: TrackedSubscription) {
  return serviceName(subscription) === "Live Stream"
    ? "Live channels and entertainment managed through your UniPlug account."
    : subscription.service?.description || "Your UniPlug-managed digital service.";
}

function serviceSlug(subscription: TrackedSubscription) {
  return serviceName(subscription).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function renewalDate(subscription: TrackedSubscription) {
  return subscription.nextRenewalDate || subscription.endDate;
}

function renewalLabel(subscription: TrackedSubscription) {
  const date = renewalDate(subscription);
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "Not scheduled";
}

function daysUntilRenewal(subscription: TrackedSubscription) {
  const date = renewalDate(subscription);
  if (!date) return null;
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function renewalCopy(subscription: TrackedSubscription) {
  const days = daysUntilRenewal(subscription);
  if (days === null) return "No renewal scheduled";
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Renews today";
  if (days === 1) return "Renews tomorrow";
  return `Renews in ${days} days`;
}

function money(subscription: TrackedSubscription) {
  const amount = subscription.bundleItemCount > 1 ? subscription.bundleTotalAmount : subscription.amount;
  const formatted = subscription.currency === "USD" ? formatUsd(amount) : formatDualPrice(amount);
  return subscription.bundleItemCount > 1 ? `${formatted} bundle total` : formatted;
}

function ServiceCard({ subscription }: { subscription: TrackedSubscription }) {
  return (
    <article className="wallet-service-card">
      <div className="wallet-service-identity">
        <ServiceArtwork accentColor="#111111" className="wallet-service-logo" logoText={serviceName(subscription).slice(0, 2).toUpperCase()} name={serviceName(subscription)} slug={serviceSlug(subscription)} />
        <div>
          <span className={`wallet-status status-${subscription.status}`}><i />{statusLabel(subscription.status)}</span>
          <h3>{serviceName(subscription)}</h3>
          <p>{subscription.billingCycle} · {money(subscription)}</p>
        </div>
      </div>
      <div className="wallet-service-renewal">
        <small>Next renewal</small>
        <strong>{renewalLabel(subscription)}</strong>
        <span>{renewalCopy(subscription)}</span>
      </div>
      <Link className="wallet-manage-link" href={`/dashboard/subscriptions/${subscription.id}`}>Manage <span aria-hidden="true">→</span></Link>
    </article>
  );
}

function EmptyServices() {
  return <div className="wallet-empty"><span aria-hidden="true">＋</span><h3>No services connected</h3><p>Browse the catalog to add your first digital service.</p><Link className="button button-dark" href="/services">Browse services</Link></div>;
}

export function TrackedClientDashboard({ name, subscriptions }: { name: string; subscriptions: TrackedSubscription[] }) {
  const active = subscriptions.filter((item) => ["active", "due_soon", "trial"].includes(item.status));
  const upcoming = [...active].filter((item) => renewalDate(item)).sort((a, b) => String(renewalDate(a)).localeCompare(String(renewalDate(b))))[0];
  const urgent = upcoming && (daysUntilRenewal(upcoming) ?? 999) <= 30;

  return (
    <section className="wallet-page">
      <header className="wallet-page-header">
        <div><p className="wallet-kicker">Your service wallet</p><h1>Welcome back, {name}.</h1><p>Access, renewals, payments, and help—together in one secure place.</p></div>
        <Link className="wallet-avatar" href="/dashboard/settings" aria-label="Open account settings">{name.slice(0, 1).toUpperCase()}</Link>
      </header>

      {urgent && upcoming ? (
        <section className="wallet-attention" aria-labelledby="attention-title">
          <div className="wallet-attention-icon" aria-hidden="true">!</div>
          <div><p>Action needed</p><h2 id="attention-title">{serviceName(upcoming)} {renewalCopy(upcoming).toLowerCase()}</h2><span>{money(upcoming)} · {renewalLabel(upcoming)}</span></div>
          <Link className="button wallet-primary-button" href={`/dashboard/support?topic=renewal&service=${encodeURIComponent(serviceName(upcoming))}`}>Renew service</Link>
        </section>
      ) : null}

      <div className="wallet-overview-bar">
        <div><span>Active services</span><strong>{active.length}</strong></div>
        <div><span>Next renewal</span><strong>{upcoming ? renewalLabel(upcoming) : "None"}</strong></div>
        <div><span>Account access</span><strong>{subscriptions.some((item) => item.hasAssignedAccount) ? "Ready" : "Pending"}</strong></div>
      </div>

      <section className="wallet-section">
        <div className="wallet-section-heading"><div><p className="wallet-kicker">Your services</p><h2>Everything you use</h2></div>{subscriptions.length > 1 ? <Link href="/dashboard/subscriptions">View all</Link> : null}</div>
        <div className="wallet-service-grid">{subscriptions.length ? subscriptions.map((subscription) => <ServiceCard key={subscription.id} subscription={subscription} />) : <EmptyServices />}</div>
      </section>

      <div className="wallet-home-grid">
        <section className="wallet-quiet-card"><div><p className="wallet-kicker">Upcoming</p><h2>Payments & renewals</h2></div>{upcoming ? <div className="wallet-timeline-item"><span className="wallet-date-tile"><b>{new Date(`${renewalDate(upcoming)}T12:00:00`).toLocaleDateString("en-KE", { day: "2-digit" })}</b><small>{new Date(`${renewalDate(upcoming)}T12:00:00`).toLocaleDateString("en-KE", { month: "short" })}</small></span><div><strong>{serviceName(upcoming)}</strong><p>{money(upcoming)} · {renewalCopy(upcoming)}</p></div></div> : <p className="wallet-muted">Nothing is currently scheduled.</p>}</section>
        <section className="wallet-quiet-card wallet-help-card"><div><p className="wallet-kicker">Need help?</p><h2>Support stays in your account</h2><p>Create a ticket and follow the response without switching to email or messaging apps.</p></div><Link className="wallet-text-link" href="/dashboard/support">Create a ticket →</Link></section>
      </div>
    </section>
  );
}

export function TrackedSubscriptionsPage({ subscriptions }: { subscriptions: TrackedSubscription[] }) {
  const active = subscriptions.filter((item) => ["active", "due_soon", "trial"].includes(item.status));
  return (
    <section className="wallet-page">
      <header className="wallet-page-header wallet-page-header-compact"><div><p className="wallet-kicker">Service library</p><h1>Your services</h1><p>Manage access, renewal dates, and support for every connected service.</p></div><Link className="button wallet-primary-button" href="/services">Add a service</Link></header>
      <div className="wallet-filter-row"><span className="active">All <b>{subscriptions.length}</b></span><span>Active <b>{active.length}</b></span><span>Needs attention <b>{subscriptions.filter((item) => ["due_soon", "past_due", "expired"].includes(item.status)).length}</b></span></div>
      <div className="wallet-service-grid">{subscriptions.length ? subscriptions.map((subscription) => <ServiceCard key={subscription.id} subscription={subscription} />) : <EmptyServices />}</div>
    </section>
  );
}

export function LegacyTrackedSubscriptionDetail({ subscription }: { subscription: TrackedSubscription }) {
  const active = ["active", "due_soon", "trial"].includes(subscription.status);
  const name = serviceName(subscription);
  return (
    <section className="wallet-page wallet-detail-page">
      <Link className="wallet-back-link" href="/dashboard/subscriptions">← All services</Link>
      <header className="wallet-detail-header">
        <ServiceArtwork accentColor="#111111" className="wallet-detail-logo" descriptive logoText={name.slice(0, 2).toUpperCase()} name={name} slug={serviceSlug(subscription)} />
        <div className="wallet-detail-title"><span className={`wallet-status status-${subscription.status}`}><i />{statusLabel(subscription.status)}</span><h1>{name}</h1><p>{serviceDescription(subscription)}</p></div>
        <div className="wallet-detail-price"><span>{subscription.billingCycle}</span><strong>{money(subscription)}</strong><small>{renewalCopy(subscription)}</small></div>
      </header>

      <nav className="wallet-detail-tabs" aria-label="Service sections"><a href="#overview" className="active">Overview</a><a href="#access">Login details</a><a href="#billing">Billing</a><a href="#support">Support</a></nav>

      <section className="wallet-renewal-banner" id="billing"><div><p className="wallet-kicker">Next renewal</p><h2>{renewalLabel(subscription)}</h2><span>{renewalCopy(subscription)} · {money(subscription)}</span></div><Link className="button wallet-primary-button" href={`/dashboard/support?topic=renewal&service=${encodeURIComponent(name)}`}>Renew service</Link></section>

      <div className="wallet-detail-grid" id="overview">
        <div className="wallet-detail-main">
          <section className="wallet-card"><div className="wallet-card-heading"><div><p className="wallet-kicker">Plan overview</p><h2>Service details</h2></div><span className={`wallet-status status-${subscription.status}`}><i />{statusLabel(subscription.status)}</span></div><dl className="wallet-detail-list"><div><dt>Plan</dt><dd>{subscription.billingCycle}</dd></div><div><dt>Price</dt><dd>{money(subscription)}</dd></div><div><dt>Started</dt><dd>{subscription.startDate ? new Date(`${subscription.startDate}T12:00:00`).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "Not recorded"}</dd></div><div><dt>Renewal</dt><dd>{renewalLabel(subscription)}</dd></div><div><dt>Payment</dt><dd>{subscription.autoRenew ? "Automatic renewal" : "Manual renewal"}</dd></div></dl></section>
          <section id="access"><AccountAccess subscriptionId={subscription.id} canReplace={active} /></section>
        </div>
        <aside className="wallet-detail-side" id="support"><section className="wallet-card wallet-support-card"><span className="wallet-support-icon" aria-hidden="true">?</span><p className="wallet-kicker">Support</p><h2>Something not working?</h2><p>Create a ticket with this service already identified. Never include passwords or one-time codes.</p><Link className="button wallet-secondary-button" href={`/dashboard/support?service=${encodeURIComponent(name)}`}>Create a ticket</Link></section><section className="wallet-card wallet-security-card"><strong>Protected access</strong><p>Login details are fetched only when you request them and automatically hidden again.</p></section></aside>
      </div>
    </section>
  );
}

export function TrackedSubscriptionDetail({ subscription }: { subscription: TrackedSubscription }) {
  const active = ["active", "due_soon", "trial"].includes(subscription.status);
  const name = serviceName(subscription);
  const isNetflix = name.toLowerCase().includes("netflix");

  return (
    <section className="wallet-page wallet-detail-page">
      <Link className="wallet-back-link" href="/dashboard/subscriptions">← All services</Link>

      <header className="service-console-header">
        <div className="service-console-identity">
          <ServiceArtwork accentColor="#111111" className="wallet-detail-logo" descriptive logoText={name.slice(0, 2).toUpperCase()} name={name} slug={serviceSlug(subscription)} />
          <div><span className={`wallet-status status-${subscription.status}`}><i />{statusLabel(subscription.status)}</span><h1>{name}</h1><p>Your access is ready below.</p></div>
        </div>
        <div className="service-console-renewal-summary"><span>Next renewal</span><strong>{renewalLabel(subscription)}</strong><small>{money(subscription)} · {renewalCopy(subscription)}</small></div>
      </header>

      <div className="service-console-layout">
        <main id="access"><AccountAccess subscriptionId={subscription.id} canReplace={active} isNetflix={isNetflix} /></main>
        <aside className="service-console-side">
          <section className="wallet-card service-renewal-card"><p className="wallet-kicker">Renewal</p><h2>{renewalLabel(subscription)}</h2><p>{subscription.billingCycle} · {money(subscription)}</p><span>{renewalCopy(subscription)}</span><Link className="button wallet-primary-button" href={`/dashboard/support?topic=renewal&service=${encodeURIComponent(name)}`}>Renew service</Link></section>
          <section className="wallet-card wallet-support-card"><span className="wallet-support-icon" aria-hidden="true">?</span><p className="wallet-kicker">Need help?</p><h2>Create a support ticket</h2><p>Tell us what went wrong. This service will already be selected for you.</p><Link className="button wallet-secondary-button" href={`/dashboard/support?service=${encodeURIComponent(name)}`}>Create ticket</Link></section>
          <section className="wallet-card wallet-security-card"><strong>Ready when you need it</strong><p>Your assigned login details stay visible on this service page for quick access.</p></section>
        </aside>
      </div>
    </section>
  );
}
