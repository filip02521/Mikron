import { PROCUREMENT_TEAM_LABEL_TITLE } from "@/lib/orders/procurement-copy";
import {
  requestDraftMissingLabels,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import { isInformacjaRequest } from "@/lib/orders/individual";
import { verificationInformacjaUiForOrder } from "@/lib/orders/verification-informacja-ui";
import type { IndividualOrder } from "@/types/database";

/** Zdania statusu weryfikacji — {@link my-order-sales-ui} rozpoznaje je po tych prefiksach. */
export const VERIFICATION_PROCUREMENT_MATCHES_SUPPLIER = `${PROCUREMENT_TEAM_LABEL_TITLE} dopasuje dostawcę.`;
export const VERIFICATION_PROCUREMENT_WILL_FILL = `${PROCUREMENT_TEAM_LABEL_TITLE} uzupełni:`;

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

  for (const label of requestDraftMissingLabels(draft)) {
    if (label === "dostawca") procurementTodo.push("dostawcę");
    if (label === "produkt") {
      procurementTodo.push("opis produktu (symbol, kod Mikran lub nazwa)");
    }
    if (label === "ilość") procurementTodo.push("ilość (szt.)");
  }

  const footer = "Prośba jest zapisana - nie musisz nic uzupełniać.";

  if (procurementTodo.length === 0) {
    const pathNote = verificationInformacjaUiForOrder(order)?.destinationSummary;
    if (pathNote && isInformacjaRequest(order)) {
      return `Zakupy sprawdzają szczegóły przed przekazaniem do panelu. ${pathNote} ${footer}`;
    }
    return `Zakupy sprawdzają szczegóły przed zamówieniem u dostawcy. ${footer}`;
  }

  if (procurementTodo.length === 1 && procurementTodo[0] === "dostawcę") {
    return `${VERIFICATION_PROCUREMENT_MATCHES_SUPPLIER} ${footer}`;
  }

  return `${VERIFICATION_PROCUREMENT_WILL_FILL} ${procurementTodo.join(", ")}. ${footer}`;
}

/** Krótkie etykiety braków — lista kolejki w weryfikacji. */
export function verificationQueueMissingLabels(order: IndividualOrder): string[] {
  const draft = orderToDraft(order);
  return requestDraftMissingLabels(draft);
}

/** Braki w bieżącym szkicu formularza (aktywna pozycja w weryfikacji). */
export function verificationDraftMissingLabels(draft: RequestDraft): string[] {
  return requestDraftMissingLabels(draft);
}
