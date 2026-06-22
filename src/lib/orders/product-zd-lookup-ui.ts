export const PRODUCT_ZD_LOOKUP_TRIGGER_LABEL =
  "Nie wiesz, czy towar jest zamówiony? Sprawdź termin dostawy";

export const PRODUCT_ZD_LOOKUP_MODAL = {
  title: "Sprawdź termin dostawy",
  description:
    "Wyszukaj towar w Subiekcie — sprawdzimy otwarte ZD u dostawcy i pokażemy planowany termin realizacji.",
  titleHint:
    "Wynik dotyczy zamówień u dostawcy (ZD), nie stanu magazynowego ani Twoich prośb w systemie.",
  searchLabel: "Szukaj produktu",
  searchPlaceholder: "Symbol, nazwa lub kod Mikran…",
  searchHint:
    "Wpisz symbol lub nazwę (min. 2 znaki) albo sam kod Mikran — same cyfry, nawet 1 znak.",
  introSteps: [
    { title: "Wybierz towar", detail: "Z kartoteki Subiekta" },
    { title: "Dostawca z bazy", detail: "Albo wybierz ręcznie" },
    { title: "Termin dostawy", detail: "Z otwartego ZD" },
  ],
  resultLabel: "Wynik wyszukiwania",
  resultHintLoading: "Łączymy towar z otwartymi dokumentami ZD u dostawcy.",
  resultHintFound: "Znaleźliśmy otwarte ZD z planowanym terminem realizacji.",
  resultHintNoMatch: "Brak otwartego ZD u dostawcy.",
  resultHintNeedsSupplier:
    "Nie mamy dostawcy tego towaru w bazie — wybierz go, żeby przeszukać ZD.",
  resultHintSupplierUnmapped:
    "Dostawca nie jest powiązany z Subiektem — uzupełnij kh_Id w panelu admina.",
  resultHintError: "Sprawdź połączenie z Subiektem i spróbuj ponownie.",
  stockOutCta: "Zgłoś brak na stanie",
  stockOutHint: "Prośba trafi do panelu Dziś (zakupy).",
  cancel: "Anuluj",
  close: "Zamknij",
  searchAgain: "Sprawdź inny towar",
  retry: "Spróbuj ponownie",
  searchWithSupplier: "Sprawdź ZD u dostawcy",
  noZdWarehouseNote:
    "Brak ZD to nie to samo co stan magazynowy.",
  appOrderHintTitle: "Szacowany termin z prośby",
  appOrderHintDetail: "",
} as const;

import type {
  ProductZdLookupAppOrderHint,
  ProductZdLookupResult,
} from "@/lib/subiekt/product-zd-lookup";
import { formatPlDate } from "@/lib/display-labels";

export function formatProductZdLookupAppOrderHint(hint: ProductZdLookupAppOrderHint): string {
  const ordered = formatPlDate(hint.orderedAt.slice(0, 10));
  const orderedLabel = ordered ? `Zamówiono ${ordered}` : null;
  return [orderedLabel, hint.estimateLabel].filter(Boolean).join(" · ");
}

export function productZdLookupAppOrderHint(
  result: ProductZdLookupResult | null
): ProductZdLookupAppOrderHint | null {
  if (!result || result.status !== "no_match") return null;
  return result.appOrderHint ?? null;
}

export function productZdLookupNoMatchSectionHint(
  result: ProductZdLookupResult | null
): string {
  if (!result || result.status !== "no_match") {
    return PRODUCT_ZD_LOOKUP_MODAL.resultHintNoMatch;
  }
  if (result.supplierName) {
    return `Brak otwartego ZD u ${result.supplierName}.`;
  }
  return PRODUCT_ZD_LOOKUP_MODAL.resultHintNoMatch;
}

export function productZdLookupResultSectionHint(
  result: ProductZdLookupResult | null,
  lookupError: string | null,
  loading: boolean
): string {
  if (loading) return PRODUCT_ZD_LOOKUP_MODAL.resultHintLoading;
  if (lookupError) return PRODUCT_ZD_LOOKUP_MODAL.resultHintError;
  if (!result) return PRODUCT_ZD_LOOKUP_MODAL.resultHintLoading;
  if (result.status === "found") return PRODUCT_ZD_LOOKUP_MODAL.resultHintFound;
  if (result.status === "needs_supplier") {
    return PRODUCT_ZD_LOOKUP_MODAL.resultHintNeedsSupplier;
  }
  if (result.status === "supplier_unmapped") {
    return PRODUCT_ZD_LOOKUP_MODAL.resultHintSupplierUnmapped;
  }
  return productZdLookupNoMatchSectionHint(result);
}

export function productZdLookupSupplierName(result: ProductZdLookupResult | null): string | null {
  if (!result) return null;
  if (
    result.status === "found" ||
    result.status === "no_match" ||
    result.status === "supplier_unmapped"
  ) {
    return result.supplierName;
  }
  return null;
}
