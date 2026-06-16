import type { IndividualOrder } from "@/types/database";
import { normalizeProcurementCancelNote } from "@/lib/orders/procurement-cancel-note";

function normalizeSearch(s: string) {
  return s.trim().toLocaleLowerCase("pl");
}

/** Szuka w nazwie towaru, symbolu (oraz pomocniczo: dostawca, handlowiec). */
export function matchesIndividualSearch(order: IndividualOrder, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = [
    order.products,
    order.symbol,
    order.supplier?.name,
    order.sales_person?.name,
    normalizeProcurementCancelNote(order.procurement_cancel_note),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pl");
  return haystack.includes(q);
}

type NormalHistorySearchRow = {
  user_email: string;
  action: string;
  suppliers?: { name: string } | null;
};

export function matchesNormalSearch(row: NormalHistorySearchRow, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = [row.user_email, row.suppliers?.name, row.action]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pl");
  return haystack.includes(q);
}
