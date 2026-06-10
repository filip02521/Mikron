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
  informacjaStockOutReorder?: boolean;
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

/** Krótkie etykiety braków w szkicu (kolejka weryfikacji, status formularza). */
export function requestDraftMissingLabels(draft: RequestDraft): string[] {
  const kind = draft.requestKind ?? "zamowienie";
  const labels: string[] = [];

  if (!hasText(draft.supplierId)) labels.push("dostawca");
  if (!hasAnyProductHint(draft)) labels.push("produkt");
  if (kind !== "informacja" && !hasValidOrderQuantity(draft.quantity, kind)) {
    labels.push("ilość");
  }

  return labels;
}

function joinPolishList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} oraz ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} oraz ${parts[parts.length - 1]}`;
}

function procurementMissingDetail(missing: string[]): string {
  const parts: string[] = [];
  if (missing.includes("dostawca")) parts.push("dostawcę");
  if (missing.includes("produkt")) {
    parts.push("opis produktu (najlepiej z Subiekta po symbolu lub kodzie Mikran)");
  }
  if (missing.includes("ilość")) parts.push("ilość (np. 1)");
  return `Wybierz ${joinPolishList(parts)}.`;
}

function defaultMissingDetail(missing: string[]): string {
  const parts: string[] = [];
  if (missing.includes("dostawca")) parts.push("dostawcę");
  if (missing.includes("produkt")) parts.push("opis produktu (symbol lub nazwa)");
  if (missing.includes("ilość")) parts.push("ilość sztuk (np. 1)");
  const joined = joinPolishList(parts);
  return `Podaj ${joined}. Dział zakupów uzupełni brakujące dane.`;
}

export function completenessUserHint(
  assessment: RequestCompleteness,
  requestKind: IndividualRequestKind,
  draft: RequestDraft = {},
  options?: { audience?: "procurement" | "default" }
): { tone: "success" | "warning"; title: string; detail: string } {
  if (assessment === "complete") {
    const isStockOut =
      requestKind === "informacja" && draft.informacjaStockOutReorder === true;
    const isViaPanel =
      requestKind === "informacja" && draft.informacjaQueueViaDailyPanel === true;
    return {
      tone: "success",
      title: "Zgłoszenie kompletne",
      detail:
        requestKind === "informacja"
          ? options?.audience === "procurement"
            ? isStockOut
              ? "Po zatwierdzeniu: sekcja „Brak na stanie” w panelu Dziś — bez e-maila do handlowca."
              : isViaPanel
                ? "Po zatwierdzeniu: Prośby handlowców (Główne), potem magazyn i e-mail."
                : "Po zatwierdzeniu: Wyjątki → kolejka magazynu (e-mail po przyjęciu)."
            : "Trafia do działu zakupów bez dodatkowej weryfikacji."
          : options?.audience === "procurement"
            ? "Dostawca, produkt i ilość są podane — można zapisać do listy na dziś."
            : "Dostawca, produkt i ilość są podane — trafia od razu do realizacji.",
    };
  }
  const dashAsZamowienie =
    requestKind === "zamowienie" && isInformacjaQuantityMarker(draft.quantity);
  const missing = requestDraftMissingLabels({ ...draft, requestKind });

  if (options?.audience === "procurement") {
    return {
      tone: "warning",
      title: "Uzupełnij przed zapisem",
      detail: dashAsZamowienie
        ? "Ilość „-” oznacza prośbę informacyjną — wybierz typ „Informacja” zamiast zamówienia u dostawcy."
        : procurementMissingDetail(missing),
    };
  }
  return {
    tone: "warning",
    title: "Wymaga weryfikacji przez dział zakupów",
    detail: dashAsZamowienie
      ? "Ilość „-” to prośba informacyjna — wybierz typ „Informacja” (bez zamawiania u dostawcy)."
      : defaultMissingDetail(missing),
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
