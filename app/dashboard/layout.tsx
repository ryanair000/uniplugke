import { PortalNav, type PortalNavItem } from "@/components/portal-nav";
import { requireMember } from "@/lib/auth";

const memberNavigation: PortalNavItem[] = [
  { href: "/dashboard", label: "Home", shortLabel: "home" },
  { href: "/dashboard/subscriptions", label: "Services", shortLabel: "services" },
  { href: "/dashboard/orders", label: "Orders", shortLabel: "orders" },
  { href: "/dashboard/support", label: "Support", shortLabel: "support" },
  { href: "/dashboard/settings", label: "Account", shortLabel: "account", aliases: ["/settings"] }
];

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Member portal access is enforced once for every nested dashboard route.
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
        <div className="portal-content">
          {children}
        </div>
      </div>
    </div>
  );
}
