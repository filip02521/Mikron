import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import {
  MAX_MIKRAN_CODE_LEN,
  MAX_PRODUCT_TEXT_LEN,
  MAX_SYMBOL_LEN,
  clampText,
} from "@/lib/security/text-limits";

export type RequestCompleteness = "complete" | "incomplete";

export type RequestDraft = {
  supplierId?: string;
  symbol?: string;
  /** Kod Mikran (tw_PLU). */
  mikranCode?: string;
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
  return hasText(draft.symbol) || hasText(draft.mikranCode) || hasText(draft.product);
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
  const symbolRaw = hasText(draft.symbol)
    ? clampText(draft.symbol!, MAX_SYMBOL_LEN)
    : "-";
  const product = hasText(draft.product)
    ? clampText(draft.product!, MAX_PRODUCT_TEXT_LEN)
    : hasText(draft.mikranCode)
      ? clampText(draft.mikranCode!, MAX_MIKRAN_CODE_LEN)
      : "";
  if (product) return { products: product, symbol: symbolRaw };
  if (hasText(draft.symbol)) {
    return { products: clampText(draft.symbol!, MAX_PRODUCT_TEXT_LEN), symbol: symbolRaw };
  }
  if (hasText(draft.mikranCode)) {
    return {
      products: clampText(draft.mikranCode!, MAX_MIKRAN_CODE_LEN),
      symbol: "-",
    };
  }
  return { products: "Do uzupełnienia", symbol: "-" };
}
