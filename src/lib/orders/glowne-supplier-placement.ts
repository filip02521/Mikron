import type { IndividualOrder } from "@/types/database";

/** Minimalne pola do ustalenia, czy Główne przesuwa harmonogram dostawcy. */
export type GlowneScheduleOrderRow = Pick<
  IndividualOrder,
  "supplier_id" | "request_kind" | "informacja_queue_via_daily_panel"
>;

/**
 * Dostawcy, u których akcja Główne wywołuje markStandardOrdered.
 * Zgodne z processIndividualFromSummary — stock_out wchodzi, via_panel nie.
 */
export function glowneScheduleSupplierIds(
  orders: GlowneScheduleOrderRow[],
  action: "GLOWNE" | "POBOCZNE" | "ANULOWANO"
): Set<string> {
  const ids = new Set<string>();
  if (action !== "GLOWNE") return ids;
  for (const order of orders) {
    if (!order.supplier_id) continue;
    if (
      order.request_kind === "informacja" &&
      order.informacja_queue_via_daily_panel
    ) {
      continue;
    }
    ids.add(order.supplier_id);
  }
  return ids;
}
