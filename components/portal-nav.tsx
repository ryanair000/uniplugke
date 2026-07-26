"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PortalNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  aliases?: string[];
};

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
      <div className="portal-nav-heading">
        <span className="portal-nav-mark" aria-hidden="true">U</span>
        <div>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
        </div>
      </div>

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
              <span aria-hidden="true">{item.shortLabel}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="portal-nav-account">
        <span>{identity.slice(0, 1).toUpperCase()}</span>
        <div>
          <small>Signed in as</small>
          <strong>@{identity}</strong>
        </div>
      </div>
    </aside>
  );
}
