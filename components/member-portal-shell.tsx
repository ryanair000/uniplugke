import { PortalNav, type PortalNavItem } from "@/components/portal-nav";
import { requireMember } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const supabase = await createServerSupabaseClient();
  const { count } = supabase
    ? await supabase
        .from("uniplug_support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", viewer.user.id)
        .eq("member_unread", true)
    : { count: 0 };
  const unreadSupport = count || 0;
  const memberItems = memberNavigation.map((item) => item.href === "/dashboard/support" ? { ...item, badge: unreadSupport } : item);
  const items = viewer.profile.role === "admin"
    ? [...memberItems, { href: "/admin", label: "Administration", shortLabel: "M" }]
    : memberItems;

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
