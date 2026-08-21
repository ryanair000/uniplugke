import { MemberNav } from "@/components/member-nav";
import { requireMember } from "@/lib/auth";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireMember();

  return (
    <div className="member-area">
      <div className="member-shell">
        <MemberNav
          username={viewer.profile.username}
          displayName={viewer.profile.displayName}
          isAdmin={viewer.profile.role === "admin"}
        />
        <div className="member-content">{children}</div>
      </div>
    </div>
  );
}
