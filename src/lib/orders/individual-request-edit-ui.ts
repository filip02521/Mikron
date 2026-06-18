import type { SummaryForSomeoneEnriched } from "@/lib/orders/summary-workspace";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { EditIndividualRequestInitial } from "@/components/orders/EditIndividualRequestModal";
import type { IndividualOrder } from "@/types/database";
import { ordersToEditLines } from "@/lib/orders/individual-request-edit";
import {
  linesHaveMixedRequestNotes,
  normalizeSalesRequestNote,
  sharedRequestNoteFromLines,
} from "@/lib/orders/sales-request-note";
import {
  informacjaFlowPathFromOrder,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";

function requestKindFromForSomeoneGroup(
  g: SummaryForSomeoneEnriched
): "zamowienie" | "informacja" {
  return g.lines.some((l) => l.informacjaStockOut || l.informacjaViaPanel)
    ? "informacja"
    : "zamowienie";
}

function informacjaPathFromForSomeoneLines(
  lines: SummaryForSomeoneEnriched["lines"]
): InformacjaFlowPath {
  if (lines.some((l) => l.informacjaStockOut)) return "stock_out";
  if (lines.some((l) => l.informacjaViaPanel)) return "via_panel";
  return "direct";
}

export function editInitialFromForSomeoneGroup(
  g: SummaryForSomeoneEnriched
): EditIndividualRequestInitial {
  const requestKind = requestKindFromForSomeoneGroup(g);
  return {
    supplierId: g.supplierId,
    salesPersonId: g.salesPersonId,
    requestKind,
    requestNote: sharedRequestNoteFromLines(g.lines) ?? "",
    requestNotesMixed: linesHaveMixedRequestNotes(g.lines),
    informacjaPath:
      requestKind === "informacja" ? informacjaPathFromForSomeoneLines(g.lines) : undefined,
    lines: g.lines.map((l) => ({
      id: l.id,
      symbol: l.symbol === "-" ? "" : l.symbol,
      mikranCode: l.mikranCode ?? "",
      product: l.products,
      quantity: l.quantity === "-" ? "" : l.quantity,
      clientName: l.clientName ?? "",
      clientKhId: l.clientKhId ?? null,
      subiektTwId: l.subiektTwId ?? null,
    })),
  };
}

export function editInitialFromMyOrderRow(row: MyOrderRow): EditIndividualRequestInitial | null {
  return {
    supplierId: row.supplierId ?? "",
    salesPersonId: row.salesPersonId,
    requestKind: row.requestKind,
    informacjaPath:
      row.requestKind === "informacja" ? (row.informacjaPath ?? "direct") : undefined,
    requestNote: sharedRequestNoteFromLines(row.lines) ?? "",
    requestNotesMixed: linesHaveMixedRequestNotes(row.lines),
    lines: row.lines.map((l) => ({
      id: l.id,
      symbol: l.symbol ?? "",
      mikranCode: l.mikranCode ?? "",
      product: l.product,
      quantity: l.quantity,
      clientName: l.clientName ?? "",
      clientKhId: l.clientKhId ?? null,
      subiektTwId: l.subiektTwId ?? null,
    })),
  };
}

export function editInitialFromOrders(orders: IndividualOrder[]): EditIndividualRequestInitial {
  const rep = orders[0];
  const requestKind = rep.request_kind ?? "zamowienie";
  const informacjaPath = informacjaFlowPathFromOrder(rep) ?? undefined;
  return {
    supplierId: rep.supplier_id ?? "",
    salesPersonId: rep.sales_person_id,
    requestKind,
    requestNote:
      sharedRequestNoteFromLines(
        orders.map((o) => ({
          requestNote: normalizeSalesRequestNote(o.sales_request_note),
        }))
      ) ?? "",
    requestNotesMixed: linesHaveMixedRequestNotes(
      orders.map((o) => ({
        requestNote: normalizeSalesRequestNote(o.sales_request_note),
      }))
    ),
    informacjaPath: requestKind === "informacja" ? informacjaPath ?? "direct" : undefined,
    lines: ordersToEditLines(orders).map((l) => ({
      id: l.id!,
      symbol: l.symbol ?? "",
      mikranCode: l.mikranCode ?? "",
      product: l.product ?? "",
      quantity: l.quantity ?? "",
      clientName: l.clientName ?? "",
      clientKhId: l.clientKhId ?? null,
      subiektTwId: l.subiektTwId ?? null,
    })),
  };
}
