import type { IndividualOrder } from "@/types/database";
import type { ZdMatchProfile } from "@/lib/warehouse/zd-receive-filter";
import { filterReceiveQueueBySupplierAndZd } from "@/lib/warehouse/zd-receive-filter";
import { normalizeMyOrderSearchText, searchQueryTokens } from "@/lib/orders/my-order-search";

/** Tekst przeszukiwany dla jednej pozycji kolejki przyjęcia. */
export function receiveQueueOrderSearchText(order: IndividualOrder): string {
  const chunks: string[] = [
    order.products,
    order.symbol ?? "",
    order.mikran_code ?? "",
    order.subiekt_tw_id != null && order.subiekt_tw_id > 0
      ? String(order.subiekt_tw_id)
      : "",
    order.sales_person?.name?.trim() ?? "",
  ];
  return normalizeMyOrderSearchText(chunks.filter(Boolean).join("\n"));
}

export function orderMatchesProductSearch(
  order: IndividualOrder,
  query: string | null | undefined
): boolean {
  const tokens = searchQueryTokens(query);
  if (!tokens.length) return true;
  const haystack = receiveQueueOrderSearchText(order);
  return tokens.every((token) => haystack.includes(token));
}

export function filterOrdersByProductSearch(
  orders: IndividualOrder[],
  query: string | null | undefined
): IndividualOrder[] {
  if (!searchQueryTokens(query).length) return orders;
  return orders.filter((order) => orderMatchesProductSearch(order, query));
}

/** Łańcuch filtrów: dostawca → ZD → wyszukiwanie towaru (AND). */
export function filterReceiveQueueTable(
  orders: IndividualOrder[],
  opts: {
    supplierFilter: string;
    zdProfile: ZdMatchProfile | null | undefined;
    productSearch: string | null | undefined;
  }
): IndividualOrder[] {
  const scoped = filterReceiveQueueBySupplierAndZd(
    orders,
    opts.supplierFilter,
    opts.zdProfile
  );
  return filterOrdersByProductSearch(scoped, opts.productSearch);
}

export function receiveQueueSearchToolbarLabel(
  matchedCount: number,
  scopedCount: number,
  query: string
): string {
  const trimmed = query.trim();
  return `${matchedCount} / ${scopedCount} pozycji (szukaj: ${trimmed})`;
}

export function receiveQueueProductSearchEmptyTitle(query: string): string {
  return `Brak pozycji pasujących do „${query.trim()}”`;
}
