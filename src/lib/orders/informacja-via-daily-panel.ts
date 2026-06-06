import {
  assessRequestCompleteness,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import { isInformacjaRequest } from "@/lib/orders/individual";
import { isInformacjaStockOutReorder } from "@/lib/orders/informacja-stock-out-reorder";
import { isIndividualOrderProcurementReady } from "@/lib/orders/procurement-readiness";
import type { IndividualOrder } from "@/types/database";

export function isInformacjaQueueViaDailyPanel(
  order: Pick<IndividualOrder, "request_kind" | "informacja_queue_via_daily_panel">
): boolean {
  return (
    isInformacjaRequest(order) && order.informacja_queue_via_daily_panel === true
  );
}

/** Informacja z checkboxem — jeszcze nie w kolejce magazynu (status Nowe + flaga). */
export function isInformacjaDeferredFromWarehouse(
  order: Pick<IndividualOrder, "request_kind" | "informacja_queue_via_daily_panel" | "status">
): boolean {
  return isInformacjaQueueViaDailyPanel(order) && order.status === "Nowe";
}

export function isInformacjaProcurementPanelReady(draft: RequestDraft): boolean {
  if ((draft.requestKind ?? "zamowienie") !== "informacja") return false;
  return assessRequestCompleteness({ ...draft, requestKind: "informacja" }) === "complete";
}

/** Czy pozycja może być w sekcji „Prośby” (Dziś) panelu dziennego. */
export function canShowInForSomeoneLeft(order: IndividualOrder): boolean {
  if (order.status !== "Nowe") return false;
  const kind = order.request_kind ?? "zamowienie";
  if (kind === "zamowienie") {
    return isIndividualOrderProcurementReady(order);
  }
  if (isInformacjaQueueViaDailyPanel(order) || isInformacjaStockOutReorder(order)) {
    return isInformacjaProcurementPanelReady({
      supplierId: order.supplier_id ?? undefined,
      symbol: order.symbol,
      mikranCode: order.mikran_code ?? undefined,
      product: order.products,
      quantity: order.quantity,
      requestKind: "informacja",
    });
  }
  return false;
}
