import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import { isInformacjaRequest } from "@/lib/orders/individual";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";

export function orderToProcurementDraft(order: IndividualOrder): RequestDraft {
  return {
    supplierId: order.supplier_id ?? undefined,
    symbol: order.symbol,
    mikranCode: order.mikran_code ?? undefined,
    product: order.products,
    quantity: order.quantity,
    requestKind: order.request_kind ?? "zamowienie",
  };
}

/** Gotowe do Główne/Uzupełniające i kolejki dostaw (dostawca + produkt + ilość). */
export function isProcurementDraftReady(draft: RequestDraft): boolean {
  if (draft.requestKind === "informacja") return false;
  return assessRequestCompleteness(draft) === "complete";
}

export function isIndividualOrderProcurementReady(order: IndividualOrder): boolean {
  return isProcurementDraftReady(orderToProcurementDraft(order));
}

export function describeProcurementReadinessGaps(order: IndividualOrder): string[] {
  const missing: string[] = [];
  const draft = orderToProcurementDraft(order);
  if (!order.supplier_id) missing.push("dostawca");
  if (!hasAnyProductHint(draft)) missing.push("opis produktu");
  if (
    !isInformacjaRequest(order) &&
    !hasValidOrderQuantity(order.quantity, order.request_kind ?? "zamowienie")
  ) {
    missing.push("ilość (szt.)");
  }
  return missing;
}

/** Status po naprawie: niekompletne nie mogą zostać „Nowe” ani trafić do kolejki dostaw. */
export function procurementGateStatus(order: IndividualOrder): IndividualOrderStatus {
  if (order.status !== "Nowe" && order.status !== "Weryfikacja") {
    return order.status;
  }
  if (isInformacjaRequest(order)) return order.status;
  return isIndividualOrderProcurementReady(order) ? "Nowe" : "Weryfikacja";
}
