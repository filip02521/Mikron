import type { IndividualRequestKind } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { isInformacjaQuantityMarker } from "@/lib/orders/informacja-import-rules";
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
  /** Informacja: najpierw kolejka Dziś, potem magazyn. */
  informacjaQueueViaDailyPanel?: boolean;
};

function hasText(value?: string): boolean {
  const t = value?.trim();
  return !!t && t !== "-";
}

/** Czy zgłoszenie ma choć jeden sensowny opis towaru. */
export function hasAnyProductHint(draft: RequestDraft): boolean {
  return hasText(draft.symbol) || hasText(draft.mikranCode) || hasText(draft.product);
}

/** Zamówienie u dostawcy wymaga liczby sztuk (1, 2…). „-” dotyczy wyłącznie informacji. */
export function hasValidOrderQuantity(
  quantity?: string,
  requestKind: IndividualRequestKind = "zamowienie"
): boolean {
  if (requestKind === "informacja") return true;
  if (isInformacjaQuantityMarker(quantity)) return false;
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
  draft: RequestDraft = {},
  options?: { audience?: "procurement" | "default" }
): { tone: "success" | "warning"; title: string; detail: string } {
  if (assessment === "complete") {
    return {
      tone: "success",
      title: "Zgłoszenie kompletne",
      detail:
        requestKind === "informacja"
          ? options?.audience === "procurement"
            ? "Można zapisać — trafi do kolejki informacji."
            : "Trafia do działu zakupów bez dodatkowej weryfikacji."
          : options?.audience === "procurement"
            ? "Dostawca, produkt i ilość są podane — można zapisać do listy na dziś."
            : "Dostawca, produkt i ilość są podane — trafia od razu do realizacji.",
    };
  }
  const missingQty =
    requestKind === "zamowienie" &&
    !hasValidOrderQuantity(draft.quantity, requestKind);
  const dashAsZamowienie =
    requestKind === "zamowienie" && isInformacjaQuantityMarker(draft.quantity);
  if (options?.audience === "procurement") {
    return {
      tone: "warning",
      title: "Uzupełnij przed zapisem",
      detail: dashAsZamowienie
        ? "Ilość „-” oznacza prośbę informacyjną — wybierz typ „Informacja” zamiast zamówienia u dostawcy."
        : missingQty
          ? "Wybierz dostawcę, produkt oraz ilość (np. 1)."
          : "Wybierz dostawcę oraz opis produktu (najlepiej z Subiekta po symbolu lub kodzie Mikran).",
    };
  }
  return {
    tone: "warning",
    title: "Wymaga weryfikacji przez dział zakupów",
    detail: dashAsZamowienie
      ? "Ilość „-” to prośba informacyjna — wybierz typ „Informacja” (bez zamawiania u dostawcy)."
      : missingQty
        ? "Podaj ilość sztuk (np. 1) oraz dostawcę i opis produktu."
        : "Podaj dostawcę oraz opis produktu (symbol lub nazwa). Dział zakupów uzupełni brakujące dane.",
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
