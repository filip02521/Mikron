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
    product: order.products,
    quantity: order.quantity,
    requestKind: order.request_kind ?? "zamowienie",
  };
}

/** Czytelny opis braków dla handlowca (status Weryfikacja). */
export function describeVerificationGaps(order: IndividualOrder): string {
  const draft = orderToDraft(order);
  const missing: string[] = [];

  if (order.supplier_resolve_pending && !order.supplier_id) {
    return "System dopasowuje dostawcę z historii ZD w Subiekcie. To zwykle trwa chwilę — odśwież listę za moment. Gdy się nie uda, dział dostaw uzupełni dane ręcznie.";
  }

  if (!order.supplier_id) missing.push("dostawca");
  if (!hasAnyProductHint(draft)) missing.push("opis produktu (symbol lub nazwa)");
  if (
    !isInformacjaRequest(order) &&
    !hasValidOrderQuantity(order.quantity, "zamowienie")
  ) {
    missing.push("ilość (szt.)");
  }

  const footer =
    "Dział dostaw uzupełni to w systemie — nie musisz nic robić.";

  if (missing.length === 0) {
    return `Zakupy sprawdzają szczegóły prośby. ${footer}`;
  }

  return `Brakuje: ${missing.join(", ")}. ${footer}`;
}
