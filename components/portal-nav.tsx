"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth";

export type PortalNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon?: string;
  aliases?: string[];
  badge?: number;
};

function NavIcon({ name }: { name: string }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>;
  if (name === "services" || name === "catalog") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>;
  if (name === "orders") return <svg {...common}><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 7h16M9 11a3 3 0 0 0 6 0"/></svg>;
  if (name === "notifications") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  if (name === "tools") return <svg {...common}><path d="M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-2.4 2.4-2.1-2.1a4 4 0 0 0 5 5L20 16.4a2.1 2.1 0 0 1-3 3l-7.7-7.7a4 4 0 0 0-5-5l2.1 2.1-2.4 2.4-2.1-2.1a4 4 0 0 0 5 5"/></svg>;
  if (name === "support" || name === "requests") return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg>;
  if (name === "account") return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  if (name === "members") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (name === "key") return <svg {...common}><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l3 3M17 6l3 3"/></svg>;
  if (name === "slots") return <svg {...common}><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>;
  if (name === "verify") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "view") return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
  if (name === "admin" || name === "M") return <svg {...common}><path d="M12 3 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-3Z"/><path d="M9 12h6M12 9v6"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>;
}

type PortalNavProps = {
  eyebrow: string;
  title: string;
  identity: string;
  items: PortalNavItem[];
  tone?: "member" | "admin";
};

export function PortalNav({
  eyebrow,
  title,
  identity,
  items,
  tone = "member"
}: PortalNavProps) {
  const pathname = usePathname();

  return (
    <aside className={`portal-nav portal-nav-${tone}`}>
      <Link className="portal-nav-heading" href="/" aria-label="UniPlug home">
        <span className="portal-nav-mark" aria-hidden="true">
          <Image src="/figma/uniplug-mark.svg" alt="" width={18} height={25} />
        </span>
        <div>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
        </div>
      </Link>

      <nav aria-label={`${title} navigation`}>
        {items.map((item) => {
          const activePath = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const activeAlias = item.aliases?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`));
          const active = item.href === "/dashboard" || item.href === "/admin"
            ? pathname === item.href
            : activePath || activeAlias;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "active" : undefined}
              href={item.href}
              key={item.href}
            >
              <span className="portal-nav-icon"><NavIcon name={item.icon || item.shortLabel} /></span>
              <span className="portal-nav-label">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="portal-nav-badge" aria-label={`${item.badge} unread`}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="portal-nav-footer">
        {tone === "admin" ? (
          <Link className="portal-nav-utility" href="/dashboard">
            <span className="portal-nav-icon"><NavIcon name="view" /></span>
            <span>Member view</span>
          </Link>
        ) : null}
        <div className="portal-nav-account">
          <span>{identity.slice(0, 1).toUpperCase()}</span>
          <div>
            <small>Signed in as</small>
            <strong>@{identity}</strong>
          </div>
        </div>
        <SignOutButton />
      </div>
      <div className="portal-mobile-account"><Link href="/dashboard/settings" aria-label="Open account"><NavIcon name="account" /></Link></div>
    </aside>
  );
}
