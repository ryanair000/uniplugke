import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile and security" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  if (query.success) params.set("success", query.success);
  if (query.error) params.set("error", query.error);
  const suffix = params.toString();
  redirect(suffix ? `/dashboard/account?${suffix}` : "/dashboard/account");
}
