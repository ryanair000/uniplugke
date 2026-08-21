import { MemberPortalShell } from "@/components/member-portal-shell";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MemberPortalShell>{children}</MemberPortalShell>;
}
