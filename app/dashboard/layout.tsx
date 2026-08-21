import type { Metadata } from "next";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireMember();

  return (
    <div className="member-area dashboard-v2-area">
      <div className="dashboard-app-shell" role="group" aria-label="Member portal">
        <DashboardNavigation username={viewer.profile.username} isAdmin={viewer.profile.role === "admin"} />
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
}
