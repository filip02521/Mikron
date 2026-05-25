import { randomId } from "@/lib/ensure-crypto";
import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { EditIndividualRequestInitial } from "@/components/orders/EditIndividualRequestModal";
import type { IndividualOrder } from "@/types/database";
import { ordersToEditLines } from "@/lib/orders/individual-request-edit";

export function editInitialFromForSomeoneGroup(
  g: SummaryForSomeoneEnriched
): EditIndividualRequestInitial {
  return {
    supplierId: g.supplierId,
    salesPersonId: g.salesPersonId,
    requestKind: "zamowienie",
    lines: g.lines.map((l) => ({
      id: l.id,
      symbol: l.symbol === "-" ? "" : l.symbol,
      product: l.products,
      quantity: l.quantity === "-" ? "" : l.quantity,
    })),
  };
}

export function editInitialFromMyOrderRow(row: MyOrderRow): EditIndividualRequestInitial | null {
  if (!row.supplierId) return null;
  return {
    supplierId: row.supplierId,
    salesPersonId: row.salesPersonId,
    requestKind: row.requestKind,
    lines: row.lines.map((l) => ({
      id: l.id,
      symbol: l.symbol ?? "",
      product: l.product,
      quantity: l.quantity,
      clientName: l.clientName ?? "",
    })),
  };
}

export function editInitialFromOrders(orders: IndividualOrder[]): EditIndividualRequestInitial {
  const rep = orders[0];
  return {
    supplierId: rep.supplier_id ?? "",
    salesPersonId: rep.sales_person_id,
    requestKind: rep.request_kind ?? "zamowienie",
    lines: ordersToEditLines(orders).map((l) => ({
      id: l.id ?? randomId(),
      symbol: l.symbol ?? "",
      product: l.product ?? "",
      quantity: l.quantity ?? "",
      clientName: l.clientName ?? "",
    })),
  };
}
