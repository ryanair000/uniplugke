"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const memberLinks = [
  { href: "/dashboard", label: "Overview", match: (path: string) => path === "/dashboard" },
  { href: "/dashboard#my-services", label: "My services", match: (path: string) => path.startsWith("/dashboard/subscriptions") },
  { href: "/dashboard/orders", label: "Orders", match: (path: string) => path.startsWith("/dashboard/orders") },
  { href: "/settings", label: "Account", match: (path: string) => path.startsWith("/settings") }
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={active ? "dashboard-nav-link active" : "dashboard-nav-link"} aria-current={active ? "page" : undefined}>
      <span>{label}</span>
    </Link>
  );
}

export function DashboardNavigation({ username, isAdmin }: { username: string; isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="dashboard-sidebar" aria-label="Member portal">
        <div className="dashboard-sidebar-head">
          <span className="dashboard-avatar" aria-hidden="true">{username.slice(0, 2).toUpperCase()}</span>
          <div><strong>@{username}</strong><small>UniPlug member</small></div>
        </div>

        <nav className="dashboard-side-nav">
          {memberLinks.map((item) => <NavLink key={item.label} href={item.href} label={item.label} active={item.match(pathname)} />)}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link className="dashboard-nav-link secondary" href="/services">Browse services</Link>
          {isAdmin ? <Link className="dashboard-nav-link secondary" href="/admin">Administration</Link> : null}
        </div>
      </aside>

      <nav className="dashboard-mobile-nav" aria-label="Member portal">
        {memberLinks.map((item) => <NavLink key={item.label} href={item.href} label={item.label} active={item.match(pathname)} />)}
      </nav>
    </>
  );
}
