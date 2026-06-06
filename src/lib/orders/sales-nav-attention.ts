import { fetchSalesShellMetrics } from "@/lib/orders/sales-shell-metrics";

/** Liczba kart wymagających działania handlowca (badge w nawigacji). */
export async function countSalesNavAttention(
  salesPersonId: string
): Promise<number> {
  const { navAttention } = await fetchSalesShellMetrics(salesPersonId);
  return navAttention;
}
