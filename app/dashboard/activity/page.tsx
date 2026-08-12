import { redirect } from "next/navigation";

export const metadata = { title: "Account activity" };

export default function ActivityPage() {
  redirect("/dashboard");
}
