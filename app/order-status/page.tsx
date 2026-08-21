import type { Metadata } from "next";
import { KeyOrderLookup } from "@/components/key-support";

export const metadata: Metadata = {
  title: "Software-key order status",
  description: "Check the payment and fulfilment status of a UniPlug software-key order.",
  robots: { index: false, follow: false }
};

export default async function OrderStatusPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const reference = (await searchParams).reference?.trim().toUpperCase() || "";
  return <KeyOrderLookup initialReference={/^KEY-[A-Z0-9-]{12,80}$/.test(reference) ? reference : ""} />;
}
