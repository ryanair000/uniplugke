import type { Metadata } from "next";
import { StoreCartPage } from "@/components/store-cart";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return <StoreCartPage />;
}
