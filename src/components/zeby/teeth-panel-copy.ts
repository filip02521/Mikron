import type { Tab } from "@/components/zeby/teeth-panel-types";

export const TEETH_PANEL_TITLE = "Panel zębów";

export const TEETH_PRZYJECIE_PAGE_TITLE = "Przyjęcie";
export const TEETH_PRZYJECIE_PAGE_HINT =
  "Porównaj dostawę z zamówieniem u dostawcy — wpisz co dotarło, a czego brakuje. Bez e-maila i regału.";

export const TEETH_TAB_PAGE_TITLES: Record<Tab, string> = {
  kolejka: "Kolejka",
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

  historia:
    "Zamówienia u dostawcy pogrupowane wg labu. Korekta daty dostawy, cofnięcie błędnego oznaczenia i dziennik operacji.",
};


