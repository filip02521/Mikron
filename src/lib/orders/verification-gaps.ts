import {
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import { isInformacjaRequest } from "@/lib/orders/individual";
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

  if (order.supplier_resolve_pending && !order.supplier_id) {
    return "Szukamy dostawcy w Subiekcie (historia ZD). To zwykle chwilę — odśwież listę za moment. Prośba jest zapisana — nie musisz nic uzupełniać.";
  }

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
    return `Zakupy sprawdzają szczegóły przed zamówieniem u dostawcy. ${footer}`;
  }

  if (procurementTodo.length === 1 && procurementTodo[0] === "dostawcę") {
    return `Dział dostaw dopasuje dostawcę. ${footer}`;
  }

  return `Dział dostaw uzupełni: ${procurementTodo.join(", ")}. ${footer}`;
}
