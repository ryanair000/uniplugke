import Link from "next/link";
import { requireMember } from "@/lib/auth";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireMember();

  return (
    <div className="member-area">
      <div className="shell member-nav-wrap">
        <nav className="member-nav" aria-label="Member portal">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/orders">Orders</Link>
          <Link href="/settings">Profile & security</Link>
          {viewer.profile.role === "admin" ? <Link href="/admin">Administration</Link> : null}
        </nav>
        <span className="member-identity">@{viewer.profile.username}</span>
      </div>
      {children}
    </div>
  );
}
