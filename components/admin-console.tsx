import Link from "next/link";
import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-heading">
        {eyebrow ? <p className="admin-kicker">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminMetricStrip({
  items
}: {
  items: Array<{ label: string; value: ReactNode; detail?: ReactNode; tone?: "default" | "good" | "warning" | "danger" }>;
}) {
  return (
    <div className="admin-metric-strip">
      {items.map((item) => (
        <div className={`admin-metric admin-metric-${item.tone || "default"}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function AdminTabs({
  tabs,
  active
}: {
  tabs: Array<{ label: string; href: string; count?: number }>;
  active: string;
}) {
  return (
    <nav className="admin-tabs" aria-label="Page views">
      {tabs.map((tab) => (
        <Link className={active === tab.href ? "active" : undefined} href={tab.href} key={tab.href}>
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? <b>{tab.count}</b> : null}
        </Link>
      ))}
    </nav>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-toolbar">{children}</div>;
}

export function AdminSection({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-surface ${className}`.trim()}>
      {title || action ? (
        <div className="admin-surface-heading">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function AdminStatus({ value, label }: { value: string; label?: string }) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <span className={`admin-status admin-status-${normalized}`}>{label || value.replaceAll("_", " ")}</span>;
}
