import { PortalNav, type PortalNavItem } from "@/components/portal-nav";
import { requireMember } from "@/lib/auth";

const memberNavigation: PortalNavItem[] = [
  { href: "/dashboard", label: "Home", shortLabel: "home" },
  { href: "/dashboard/subscriptions", label: "Services", shortLabel: "services" },
  { href: "/tools/verify", label: "Tools", shortLabel: "tools" },
  { href: "/dashboard/orders", label: "Orders", shortLabel: "orders" },
  { href: "/dashboard/notifications", label: "Notifications", shortLabel: "notifications", aliases: ["/dashboard/activity"] },
  { href: "/dashboard/support", label: "Support", shortLabel: "support" },
  { href: "/dashboard/settings", label: "Account", shortLabel: "account", aliases: ["/settings"] }
];

export async function MemberPortalShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireMember();
  const items = viewer.profile.role === "admin"
    ? [...memberNavigation, { href: "/admin", label: "Administration", shortLabel: "M" }]
    : memberNavigation;

  return (
    <div className="member-area">
      <div className="shell portal-layout">
        <PortalNav
          eyebrow="Service wallet"
          identity={viewer.profile.username}
          items={items}
          title="My UniPlug"
        />
        <div className="portal-content">{children}</div>
      </div>
    </div>
  );
}
