"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/components/catalog";
import type { CartItem } from "@/lib/types";

export function RenewPlanButton({ item, disabled = false }: { item: CartItem; disabled?: boolean }) {
  const router = useRouter();
  const { add, items } = useCart();
  const added = items.some((entry) => entry.planId === item.planId);

  return (
    <button
      type="button"
      className="button button-dark"
      disabled={disabled}
      onClick={() => {
        if (!added) add(item);
        router.push("/checkout");
      }}
    >
      {added ? "Continue renewal checkout" : "Renew this plan"}
    </button>
  );
}
