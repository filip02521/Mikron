import {
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import { isInformacjaRequest } from "@/lib/orders/individual";
import { verificationInformacjaUiForOrder } from "@/lib/orders/verification-informacja-ui";
import type { IndividualOrder } from "@/types/database";

function orderToDraft(order: IndividualOrder): RequestDraft {
  return {
    supplierId: order.supplier_id ?? undefined,
    symbol: order.symbol,
    mikranCode: order.mikran_code ?? undefined,
    product: order.products,
    quantity: order.quantity,
    requestKind: order.request_kind ?? "zamowienie",
  };
}

/** Czytelny opis etapu prośby w statusie Weryfikacja (dla handlowca). */
export function describeVerificationGaps(order: IndividualOrder): string {
  const draft = orderToDraft(order);
  const procurementTodo: string[] = [];

  if (!order.supplier_id) procurementTodo.push("dostawcę");
  if (!hasAnyProductHint(draft)) {
    procurementTodo.push("opis produktu (symbol, kod Mikran lub nazwa)");
  }
  if (
    !isInformacjaRequest(order) &&
    !hasValidOrderQuantity(order.quantity, "zamowienie")
  ) {
    procurementTodo.push("ilość (szt.)");
  }

  const footer = "Prośba jest zapisana — nie musisz nic uzupełniać.";

  if (procurementTodo.length === 0) {
    const pathNote = verificationInformacjaUiForOrder(order)?.destinationSummary;
    if (pathNote && isInformacjaRequest(order)) {
      return `Zakupy sprawdzają szczegóły przed przekazaniem do panelu. ${pathNote} ${footer}`;
    }
    return `Zakupy sprawdzają szczegóły przed zamówieniem u dostawcy. ${footer}`;
  }

  if (procurementTodo.length === 1 && procurementTodo[0] === "dostawcę") {
    return `Dział dostaw dopasuje dostawcę. ${footer}`;
  }

  return `Dział dostaw uzupełni: ${procurementTodo.join(", ")}. ${footer}`;
}

/** Krótkie etykiety braków — lista kolejki w weryfikacji. */
export function verificationQueueMissingLabels(order: IndividualOrder): string[] {
  const draft = orderToDraft(order);
  const labels: string[] = [];

  if (!order.supplier_id) labels.push("dostawca");
  if (!hasAnyProductHint(draft)) labels.push("produkt");
  if (
    !isInformacjaRequest(order) &&
    !hasValidOrderQuantity(order.quantity, "zamowienie")
  ) {
    labels.push("ilość");
  }

  return labels;
}

/** Braki w bieżącym szkicu formularza (aktywna pozycja w weryfikacji). */
export function verificationDraftMissingLabels(
  draft: RequestDraft
): string[] {
  const labels: string[] = [];

  if (!draft.supplierId?.trim()) labels.push("dostawca");
  if (!hasAnyProductHint(draft)) labels.push("produkt");
  if (
    draft.requestKind !== "informacja" &&
    !hasValidOrderQuantity(draft.quantity, "zamowienie")
  ) {
    labels.push("ilość");
  }

  return labels;
}
