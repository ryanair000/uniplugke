import "server-only";

export type PaymentOrderKind = "key" | "store" | "member";

type PaymentOrderConfig = {
  kind: PaymentOrderKind;
  table: "uniplug_key_orders" | "uniplug_store_orders" | "uniplug_member_orders";
  amountColumn: "amount_kes" | "total_kes";
  paidFulfillmentStatus: "pending_delivery" | "processing" | "pending_activation";
};

export function getPaymentOrderConfig(reference: string): PaymentOrderConfig {
  if (reference.startsWith("KEY-")) return {
    kind: "key" as const,
    table: "uniplug_key_orders",
    amountColumn: "amount_kes",
    paidFulfillmentStatus: "pending_delivery"
  };
  if (reference.startsWith("ST-")) return {
    kind: "store" as const,
    table: "uniplug_store_orders",
    amountColumn: "total_kes",
    paidFulfillmentStatus: "processing"
  };
  return {
    kind: "member" as const,
    table: "uniplug_member_orders",
    amountColumn: "total_kes",
    paidFulfillmentStatus: "pending_activation"
  };
}
