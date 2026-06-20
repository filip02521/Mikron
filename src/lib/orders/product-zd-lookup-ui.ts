export const PRODUCT_ZD_LOOKUP_TRIGGER_LABEL =
  "Nie wiesz, czy towar jest zamówiony? Sprawdź termin dostawy";

export const PRODUCT_ZD_LOOKUP_MODAL = {
  title: "Sprawdź termin dostawy",
  titleHint:
    "Wyszukujemy towar w Subiekcie, potem otwarte dokumenty ZD u dostawcy. Wynik dotyczy zamówień u dostawcy, nie stanu na magazynie.",
  searchLabel: "Produkt z Subiekta",
  searchPlaceholder: "Symbol, nazwa lub kod Mikran…",
  searchHint: "Wybierz pozycję z listy — ręczny tekst bez powiązania z Subiektem nie wystarczy.",
  lookupTitle: "Szukamy w dokumentach ZD",
  lookupSteps: {
    product: "Towar z Subiekta",
    supplier: "Dostawca z katalogu",
    zd: "Dokumenty ZD u dostawcy",
  },
  stockOutCta: "Zgłoś brak na stanie",
  stockOutHint: "Prośba trafi do panelu Dziś (zakupy) — bez wpisu w „Moje zamówienia”.",
  close: "Zamknij",
  searchAgain: "Sprawdź inny towar",
  retry: "Spróbuj ponownie",
} as const;

export type ProductZdLookupStepState = "done" | "active" | "pending" | "skipped";

export function productZdLookupStepClass(state: ProductZdLookupStepState): string {
  switch (state) {
    case "done":
      return "text-emerald-700";
    case "active":
      return "text-indigo-700 font-medium";
    case "skipped":
      return "text-slate-400 line-through";
    default:
      return "text-slate-500";
  }
}
