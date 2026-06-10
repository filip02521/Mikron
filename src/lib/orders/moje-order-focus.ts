import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

export const MOJE_FOCUS_ORDERS_PARAM = "focusOrders";

export function parseMojeFocusOrderIds(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function appendMojeFocusOrderIds(href: string, orderIds: string[]): string {
  if (!orderIds.length) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set(MOJE_FOCUS_ORDERS_PARAM, orderIds.join(","));
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

/** Mapuje ID pojedynczych prośb na ID wierszy listy /moje. */
export function findMyOrderRowIdsForFocusOrderIds(
  rows: MyOrderRow[],
  focusOrderIds: string[]
): string[] {
  if (!focusOrderIds.length) return [];
  const focus = new Set(focusOrderIds);
  return rows.filter((row) => row.orderIds.some((id) => focus.has(id))).map((row) => row.id);
}

export function myOrderRowsMatchingFocusOrderIds(
  rows: MyOrderRow[],
  focusOrderIds: string[]
): MyOrderRow[] {
  if (!focusOrderIds.length) return [];
  const focus = new Set(focusOrderIds);
  return rows.filter((row) => row.orderIds.some((id) => focus.has(id)));
}
