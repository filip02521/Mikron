import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";

export type RequestCompleteness = "complete" | "incomplete";

export type RequestDraft = {
  supplierId?: string;
  symbol?: string;
  product?: string;
  quantity?: string;
  salesPersonId?: string;
  requestKind?: IndividualRequestKind;
};

function hasText(value?: string): boolean {
  const t = value?.trim();
  return !!t && t !== "-";
}

/** Czy zgłoszenie ma choć jeden sensowny opis towaru. */
export function hasAnyProductHint(draft: RequestDraft): boolean {
  return hasText(draft.symbol) || hasText(draft.product);
}

/** Zamówienie u dostawcy wymaga dodatniej liczby sztuk (np. 1, 2). */
export function hasValidOrderQuantity(
  quantity?: string,
  requestKind: IndividualRequestKind = "zamowienie"
): boolean {
  if (requestKind === "informacja") return true;
  return parseOrderQuantity(quantity?.trim() ?? "") !== null;
}

/**
 * Kompletne = dostawca + (symbol lub produkt) + ilość (dla zamówienia).
 * Niekompletne trafia do Weryfikacji.
 */
export function assessRequestCompleteness(draft: RequestDraft): RequestCompleteness {
  const kind = draft.requestKind ?? "zamowienie";
  if (!hasAnyProductHint(draft)) return "incomplete";
  if (!hasText(draft.supplierId)) return "incomplete";
  if (!hasValidOrderQuantity(draft.quantity, kind)) return "incomplete";
  return "complete";
}

export function completenessUserHint(
  assessment: RequestCompleteness,
  requestKind: IndividualRequestKind,
  draft: RequestDraft = {}
): { tone: "success" | "warning"; title: string; detail: string } {
  if (assessment === "complete") {
    return {
      tone: "success",
      title: "Zgłoszenie kompletne",
      detail:
        requestKind === "informacja"
          ? "Trafia do działu dostaw bez dodatkowej weryfikacji."
          : "Dostawca, produkt i ilość są podane — trafia do panelu dziennego.",
    };
  }
  const missingQty =
    requestKind === "zamowienie" && !hasValidOrderQuantity(draft.quantity, requestKind);
  return {
    tone: "warning",
    title: "Wymaga weryfikacji przez dział dostaw",
    detail: missingQty
      ? "Podaj ilość (liczba sztuk, np. 1), dostawcę oraz opis produktu — bez tego dział dostaw nie wie, ile zamówić."
      : "Podaj dostawcę oraz opis produktu (symbol lub nazwa). Zakupy uzupełnią brakujące dane.",
  };
}

export function normalizeDraftProducts(draft: RequestDraft): {
  products: string;
  symbol: string;
} {
  const symbol = hasText(draft.symbol) ? draft.symbol!.trim() : "-";
  const product = hasText(draft.product) ? draft.product!.trim() : "";
  if (product) return { products: product, symbol };
  if (hasText(draft.symbol)) return { products: draft.symbol!.trim(), symbol };
  return { products: "Do uzupełnienia", symbol: "-" };
}
