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
  searchHint: "Wpisz min. 3 znaki i wybierz pozycję z listy Subiekta.",
  introSteps: [
    { title: "Wybierz towar", detail: "Z kartoteki Subiekta" },
    { title: "Przeszukamy ZD", detail: "U powiązanego dostawcy" },
    { title: "Termin dostawy", detail: "Albo szybka prośba o brak" },
  ],
  lookupTitle: "Postęp wyszukiwania",
  lookupSteps: {
    product: "Towar z Subiekta",
    supplier: "Dostawca z katalogu",
    zd: "Dokumenty ZD u dostawcy",
  },
  stockOutCta: "Zgłoś brak na stanie",
  stockOutHint: "Prośba trafi do panelu Dziś (zakupy) — bez wpisu w „Moje zamówienia”.",
  cancel: "Anuluj",
  close: "Zamknij",
  searchAgain: "Sprawdź inny towar",
  retry: "Spróbuj ponownie",
} as const;

import type { ProductZdLookupResult } from "@/lib/subiekt/product-zd-lookup";

export type ProductZdLookupStepState = "done" | "active" | "pending" | "skipped";

export function productZdLookupSupplierName(result: ProductZdLookupResult | null): string | null {
  if (!result) return null;
  if (result.status === "found" || result.status === "no_match") {
    return result.supplierName;
  }
  return null;
}

export function productZdLookupStepClass(state: ProductZdLookupStepState): string {
  switch (state) {
    case "done":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "active":
      return "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-900/5";
    case "skipped":
      return "border-slate-200 bg-slate-50 text-slate-400";
    default:
      return "border-slate-200/90 bg-white text-slate-600";
  }
}
