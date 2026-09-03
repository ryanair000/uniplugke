"use client";

import Link from "next/link";
import { useState } from "react";

type AdminTab = { label: string; href: string; count?: number };

export function AdminTabsTransition({ tabs, active }: { tabs: AdminTab[]; active: string }) {
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const pendingHref = pending?.from === active ? pending.href : null;
  const displayActive = pendingHref || active;

  return (
    <nav className="admin-tabs" aria-label="Page views">
      {tabs.map((tab) => {
        const selected = displayActive === tab.href;
        const isPending = pendingHref === tab.href;
        return (
          <Link
            aria-busy={isPending || undefined}
            aria-current={selected ? "page" : undefined}
            className={selected ? "active" : undefined}
            href={tab.href}
            key={tab.href}
            prefetch
            onClick={(event) => {
              if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              if (active !== tab.href) setPending({ href: tab.href, from: active });
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? <b>{tab.count}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}
