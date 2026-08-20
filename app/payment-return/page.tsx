import { PaymentStatus } from "@/components/checkout";
import { isKeysStoreRequest } from "@/lib/site-mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status" };

export default async function PaymentReturnPage({
  searchParams
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const query = await searchParams;
  const reference = query.reference || query.trxref || null;
  const keyOrder = await isKeysStoreRequest();
  const storeOrder = Boolean(reference?.startsWith("ST-"));
  return <section className="auth-page"><PaymentStatus reference={reference} keyOrder={keyOrder && !storeOrder} storeOrder={storeOrder} /></section>;
}
