"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview", icon: "⌂", exact: true },
  { href: "/dashboard/subscriptions", label: "My Services", icon: "◫" },
  { href: "/dashboard/orders", label: "Orders & Billing", icon: "▤" },
  { href: "/dashboard/support", label: "Support", icon: "?" },
  { href: "/dashboard/account", label: "Account", icon: "○" }
];

export function MemberNav({
  username,
  displayName,
  isAdmin
}: {
  username: string;
  displayName?: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="member-sidebar">
      <div className="member-sidebar-head">
        <span className="member-sidebar-kicker">Member portal</span>
        <strong>My UniPlug</strong>
      </div>
      <nav className="member-nav" aria-label="Member portal">
        {links.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} key={item.href}>
              <span className="member-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        {isAdmin ? (
          <Link className={pathname.startsWith("/admin") ? "active" : ""} href="/admin">
            <span className="member-nav-icon" aria-hidden="true">◇</span>
            <span>Administration</span>
          </Link>
        ) : null}
      </nav>
      <div className="member-sidebar-user">
        <span className="member-avatar" aria-hidden="true">{(displayName || username).slice(0, 1).toUpperCase()}</span>
        <div><strong>{displayName || username}</strong><span>@{username}</span></div>
      </div>
    </aside>
  );
}
