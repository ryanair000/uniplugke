import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Support",
  description: "Create and track support requests for your UniPlug account."
};

export default async function HelpPage() {
  await requireMember();
  redirect("/dashboard/support");
}
