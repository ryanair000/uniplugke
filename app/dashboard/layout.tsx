import { PortalNav, type PortalNavItem } from "@/components/portal-nav";
import { requireMember } from "@/lib/auth";

const memberNavigation: PortalNavItem[] = [
  { href: "/dashboard", label: "Overview", shortLabel: "O" },
  { href: "/dashboard/subscriptions", label: "Subscriptions", shortLabel: "S" },
  { href: "/dashboard/orders", label: "Orders", shortLabel: "R" },
  { href: "/dashboard/activity", label: "Activity", shortLabel: "A" },
  { href: "/dashboard/settings", label: "Profile & security", shortLabel: "P", aliases: ["/settings"] }
];

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireMember();
  const items = viewer.profile.role === "admin"
    ? [...memberNavigation, { href: "/admin", label: "Administration", shortLabel: "M" }]
    : memberNavigation;

  return (
    <div className="member-area">
      <div className="shell portal-layout">
        <PortalNav
          eyebrow="Member portal"
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
