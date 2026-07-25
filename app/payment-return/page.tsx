import { PaymentStatus } from "@/components/checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status" };

export default async function PaymentReturnPage({
  searchParams
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const query = await searchParams;
  const reference = query.reference || query.trxref || null;
  return <section className="auth-page"><PaymentStatus reference={reference} /></section>;
}
