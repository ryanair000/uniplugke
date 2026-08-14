import { PortalNav, type PortalNavItem } from "@/components/portal-nav";
import { requireAdmin } from "@/lib/auth";

const adminNavigation: PortalNavItem[] = [
  { href: "/admin", label: "Overview", shortLabel: "O" },
  { href: "/admin/orders", label: "Orders", shortLabel: "R" },
  { href: "/admin/requests", label: "Requests", shortLabel: "Q" },
  { href: "/admin/key-requests", label: "Key sourcing", shortLabel: "K" },
  { href: "/admin/members", label: "Members", shortLabel: "M" },
  { href: "/admin/catalog", label: "Catalog & plans", shortLabel: "C" },
  { href: "/admin/mailboxes", label: "VeriFy ops", shortLabel: "Y" },
  { href: "/dashboard", label: "Member view", shortLabel: "V" }
];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireAdmin();

  return (
    <div className="member-area admin-area">
      <div className="shell portal-layout">
        <PortalNav
          eyebrow="Operations"
          identity={viewer.profile.username}
          items={adminNavigation}
          title="UniPlug admin"
          tone="admin"
        />
        <div className="portal-content">
          {children}
        </div>
      </div>
    </div>
  );
}
