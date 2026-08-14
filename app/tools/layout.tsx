import { MemberPortalShell } from "@/components/member-portal-shell";

export default async function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MemberPortalShell>{children}</MemberPortalShell>;
}
