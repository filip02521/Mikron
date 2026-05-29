import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

/** Filtr tekstowy po kliencie (sales_client_name) lub produkcie. */
export function rowMatchesClientQuery(row: MyOrderRow, query: string | null | undefined): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  const client = row.clientLabel?.toLowerCase() ?? "";
  const product = row.product?.toLowerCase() ?? "";
  return client.includes(q) || product.includes(q);
}

export function filterMyOrderRowsByClient(
  rows: MyOrderRow[],
  query: string | null | undefined
): MyOrderRow[] {
  const q = query?.trim();
  if (!q) return rows;
  return rows.filter((row) => rowMatchesClientQuery(row, q));
}
