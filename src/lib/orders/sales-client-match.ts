import { normalizeMyOrderSearchText } from "@/lib/orders/my-order-search";

export function normalizeSalesClientKhId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Porównanie etykiet klienta (bez polskich znaków, zawiera). */
export function clientLabelsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeMyOrderSearchText(a ?? "");
  const nb = normalizeMyOrderSearchText(b ?? "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

/** Dokładne dopasowanie etykiety — gdy jedna strona ma kh, a druga nie. */
export function clientLabelsMatchExact(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeMyOrderSearchText(a ?? "");
  const nb = normalizeMyOrderSearchText(b ?? "");
  return Boolean(na && nb && na === nb);
}

export type SalesClientIdentity = {
  client_kh_id?: number | null;
  client_label: string;
};

export type SalesClientOrderIdentity = {
  sales_client_kh_id: number | null;
  sales_client_name: string | null;
};

/** Ta sama logika co przy powiązaniu ZK ↔ prośba (notatnik). */
export function clientsMatchForSalesClient(
  client: SalesClientIdentity,
  order: SalesClientOrderIdentity
): boolean {
  const clientKh = normalizeSalesClientKhId(client.client_kh_id);
  const orderKh = normalizeSalesClientKhId(order.sales_client_kh_id);
  if (clientKh != null && orderKh != null) return clientKh === orderKh;
  if (clientKh != null && orderKh == null) {
    return clientLabelsMatchExact(client.client_label, order.sales_client_name);
  }
  if (clientKh == null && orderKh != null) {
    return clientLabelsMatchExact(client.client_label, order.sales_client_name);
  }
  return clientLabelsMatch(client.client_label, order.sales_client_name);
}
