import type { IndividualOrder, IndividualRequestKind } from "@/types/database";

/** Prośbę można edytować, dopóki dział dostaw jej nie złożył u dostawcy. */
export function isIndividualOrderEditable(order: IndividualOrder): boolean {
  if (order.sales_cancelled_at) return false;
  return order.status === "Nowe" || order.status === "Weryfikacja";
}

export function canEditIndividualRequestGroup(orders: IndividualOrder[]): boolean {
  return orders.length > 0 && orders.every(isIndividualOrderEditable);
}

export type IndividualRequestEditLineInput = {
  /** Istniejąca pozycja — brak id = nowa linia w tej samej prośbie. */
  id?: string;
  symbol?: string;
  product?: string;
  quantity?: string;
  clientName?: string;
  subiektTwId?: number | null;
};

export type IndividualRequestEditPayload = {
  supplierId: string;
  salesPersonId: string;
  requestKind: IndividualRequestKind;
  lines: IndividualRequestEditLineInput[];
};

export function ordersToEditLines(orders: IndividualOrder[]): IndividualRequestEditLineInput[] {
  return orders.map((o) => ({
    id: o.id,
    symbol: o.symbol !== "-" ? o.symbol : "",
    product: o.products !== "Do uzupełnienia" ? o.products : "",
    quantity: o.quantity !== "-" ? o.quantity : "",
    clientName: o.sales_client_name ?? "",
    subiektTwId: o.subiekt_tw_id ?? null,
  }));
}
