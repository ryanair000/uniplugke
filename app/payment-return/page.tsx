import { PaymentStatus } from "@/components/checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status" };

export default function PaymentReturnPage() {
  return <section className="auth-page"><PaymentStatus /></section>;
}
