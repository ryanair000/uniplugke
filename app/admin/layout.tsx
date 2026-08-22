import { PortalNav, type PortalNavItem } from "@/components/portal-nav";
import { requireAdmin } from "@/lib/auth";

const adminNavigation: PortalNavItem[] = [
  { href: "/admin", label: "Overview", shortLabel: "O", icon: "home" },
  { href: "/admin/members", label: "Members", shortLabel: "M", icon: "members" },
  { href: "/admin/orders", label: "Orders", shortLabel: "R", icon: "orders" },
  { href: "/admin/support", label: "Support", shortLabel: "U", icon: "support" },
  { href: "/admin/requests", label: "Requests", shortLabel: "Q", icon: "requests" },
  { href: "/admin/catalog", label: "Catalog", shortLabel: "C", icon: "catalog" },
  { href: "/admin/slots", label: "Slots", shortLabel: "S", icon: "slots" },
  { href: "/admin/mailboxes", label: "VeriFy", shortLabel: "Y", icon: "verify", aliases: ["/admin/verify"] },
  { href: "/admin/key-requests", label: "Key sourcing", shortLabel: "K", icon: "key" }
];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireAdmin();

  return (
    <div className="member-area admin-area admin-console-area">
      <div className="portal-layout admin-console-layout">
        <PortalNav
          eyebrow="Operations"
          identity={viewer.profile.username}
          items={adminNavigation}
          title="UniPlug admin"
          tone="admin"
        />
        <div className="portal-content admin-console-content">
          {children}
        </div>
      </div>
    </div>
  );
}
