import type { Tab } from "@/components/zeby/teeth-panel-types";
import { formError } from "@/lib/ui/notice-copy";

export const TEETH_PANEL_TITLE = "Panel zębów";

export const TEETH_PRZYJECIE_PAGE_TITLE = "Przyjęcie";
export const TEETH_PRZYJECIE_PAGE_HINT =
  "Porównaj dostawę z zamówieniem u dostawcy — wpisz co dotarło, a czego brakuje. Bez e-maila i regału.";

export const TEETH_BRAKI_PAGE_TITLE = "Braki u dostawców";
export const TEETH_BRAKI_PAGE_HINT =
  "Warianty zębów niedostępne u dostawcy — handlowiec zobaczy ostrzeżenie przy prośbie (bez blokady wysyłki).";

export const TEETH_BRAKI_ADD_COPY = {
  ctaLabel: "Dodaj brak",
  ctaHint: "Wariant niedostępny u dostawcy",
  emptyTitle: "Lista braków jest pusta",
  emptyDescription:
    "Dodaj kolor i fason, którego dostawca chwilowo nie ma — handlowiec zobaczy ostrzeżenie przy prośbie.",
  emptyFilteredTitle: "Brak wyników",
  emptyFilteredDescription:
    "Żaden wpis nie pasuje do filtrów. Wyczyść filtry albo dodaj nowy brak.",
  emptyAction: "Dodaj pierwszy brak",
} as const;
export const TEETH_TAB_PAGE_TITLES: Record<Tab, string> = {
  kolejka: "Kolejka",
  weryfikacja: "Weryfikacja zębów",
  historia: "Historia",
};

export const TEETH_PANEL_HINT =

  "Prośby handlowców na zęby syntetyczne — oznaczaj status w systemie po kontakcie z dostawcą.";



export const TEETH_MARK_ORDERED_LABEL = "Oznacz jako zamówione";

export const TEETH_MARK_ORDERED_TITLE =
  "Po zamówieniu u dostawcy: oznacza prośby z kompletną listą zębów i przesuwa harmonogram cyklu.";

/** @deprecated Użyj TEETH_MARK_ORDERED_LABEL */
export const TEETH_SCHEDULE_ORDER_LABEL = TEETH_MARK_ORDERED_LABEL;
/** @deprecated Użyj TEETH_MARK_ORDERED_TITLE */
export const TEETH_SCHEDULE_ORDER_TITLE = TEETH_MARK_ORDERED_TITLE;

export const TEETH_TAB_HINTS: Record<Tab, string> = {

  kolejka:

    "Prośby pogrupowane wg dostawcy. Jedno „Oznacz jako zamówione” — dla prośb handlowców i/lub cyklu z harmonogramu.",

  weryfikacja:
    "Prośby z listą zębów wczytaną ze zdjęcia. Zweryfikuj pozycje i zatwierdź, lub popraw przed zamówieniem.",

  historia:
    "Zamówienia pogrupowane wg dostawcy. Korekta daty dostawy, cofnięcie błędnego oznaczenia i dziennik operacji.",
};

export const TEETH_QUICK_ORDER_COPY = {
  title: "Nowa prośba zębowa",
  titleHint:
    "Tylko produkty z katalogu zębów. Po zapisie prośba trafia do kolejki panelu zębów — nie do panelu dziennego.",
  banner: "Formularz tylko dla zębów syntetycznych — inne towary tu nie przejdą.",
  delegateHint: "Prośba będzie widoczna u wybranego handlowca w Moje zamówienia.",
  submitLabel: "Dodaj prośbę zębową",
  ctaLabel: "Nowa prośba zębowa",
  emptyCatalog: formError(
    "Brak katalogu zębów",
    "Dodaj produkty w Admin → Produkty zębowe, zanim złożysz prośbę z tego panelu.",
  ),
  nonTeethProduct: formError(
    "Tylko produkty zębowe",
    "Wybierz produkt z katalogu zębów i uzupełnij listę zębów.",
  ),
  emptyQueueAction: "Dodaj prośbę zębową",
  emptyQueueDescription:
    "Dodaj prośbę zębową z tego panelu albo poczekaj, aż handlowiec złoży ją w formularzu prośby — wtedy pojawi się tu do zamówienia u dostawcy.",
} as const;
