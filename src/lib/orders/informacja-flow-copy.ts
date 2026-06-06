/** Wspólne opisy ścieżek prośby informacyjnej (panel zakupów, magazyn, handlowiec). */

export const INFORMACJA_FLOW_DIRECT = {
  id: "direct" as const,
  label: "Informacja o dostępności",
  short: "Informacja o dotarciu towaru na magazyn.",
  steps: ["Zgłoszenie", "Kolejka informacji (magazyn)", "E-mail do handlowca"],
};

export const INFORMACJA_FLOW_VIA_PANEL = {
  id: "via_panel" as const,
  label: "Najpierw zamówienie u dostawcy",
  short:
    "Najpierw zamówienie u dostawcy w panelu Dziś, potem sprawdzenie na magazynie i e-mail do handlowca.",
  steps: [
    "Zgłoszenie handlowca",
    "Zamówienie u dostawcy (Główne lub Uzupełniające)",
    "Sprawdzenie na magazynie",
    "Wiadomość e-mail do handlowca",
  ],
};

/** Tylko sygnał dla działu zakupów — bez kolejki magazynu i bez powiadomienia handlowca. */
export const INFORMACJA_FLOW_STOCK_OUT = {
  id: "stock_out" as const,
  label: "Brak na stanie — do zamówienia",
  short: "Zgłoś do działu zakupów, że brakuje towaru na stanie.",
  steps: ["Zgłoszenie", "Panel Dziś — zamówienie u dostawcy"],
};

export const INFORMACJA_STOCK_OUT_PANEL_BADGE = "Brak na stanie";

export const INFORMACJA_STOCK_OUT_PANEL_BANNER =
  "Koniec stanu magazynowego — zamów u dostawcy (Główne). Handlowiec nie śledzi tej pozycji.";

export const INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT =
  "To nie są prośby klientów — sygnały, że towar się skończył na magazynie. Po Główne pozycja znika z listy.";

export const INFORMACJA_FLOW_SALES_STOCK_OUT = {
  statusTitle: "Brak na stanie — zakupy zamówią",
  statusDetail:
    "To tylko sygnał dla działu zakupów. Nie czekasz na e-mail z magazynu — postęp zobaczysz po zamówieniu u dostawcy.",
};

export const INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED = {
  statusTitle: "Zamówione u dostawcy",
  statusDetail:
    "Zakupy złożyły zamówienie. Nie dostaniesz e-maila z magazynu — to był tylko sygnał o braku stanu.",
};

/** Etykieta na pozycji w panelu Dziś (ścieżka: magazyn sprawdza, potem informacja dla handlowca). */
export const INFORMACJA_VIA_PANEL_BADGE = "Magazyn → info";

export const INFORMACJA_VIA_PANEL_STATUS_TITLE = INFORMACJA_VIA_PANEL_BADGE;

export const INFORMACJA_FLOW_LEGEND_PANEL =
  "„Informacja o dostępności” — magazyn obserwuje towar i wysyła e-mail po przyjęciu. „Brak na stanie” — tylko Prośby handlowców (zakupy zamawiają u dostawcy, bez e-maila z magazynu).";

/** Krótki opis pod pozycją w panelu Dziś (szczegóły ścieżki: badge + legenda). */
export const INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER =
  "Prośba informacyjna — najpierw zamów u dostawcy, potem magazyn wyśle e-mail do handlowca.";

export const INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT = {
  statusTitle: "Czekamy na zamówienie u dostawcy",
  statusDetail:
    "Dział zakupów złoży zamówienie u dostawcy. Gdy towar dotrze na magazyn, dostaniesz e-mail.",
};

export const INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE = {
  statusTitle: "Zamówione — czekamy na magazyn",
  statusDetail:
    "Zamówienie u dostawcy jest złożone. Powiadomimy e-mailem, gdy towar pojawi się na magazynie.",
};

export const INFORMACJA_FLOW_SALES_DIRECT = {
  statusTitle: "Informacja o dostępności",
  statusDetail:
    "Magazyn obserwuje, czy towar dotrze na magazyn. Powiadomimy e-mailem po przyjęciu.",
};

/** Poprzedni tytuł statusu — zostaje w starych wpisach / testach. */
export const INFORMACJA_AVAILABILITY_STATUS_TITLE_LEGACY = "Oczekuje na magazyn";

export function isInformacjaAvailabilityPendingStatusTitle(title: string): boolean {
  return (
    title === INFORMACJA_FLOW_SALES_DIRECT.statusTitle ||
    title === INFORMACJA_AVAILABILITY_STATUS_TITLE_LEGACY
  );
}

export const INFORMACJA_FLOW_MY_ORDERS_HINT =
  "W „Moje zamówienia” widać tylko „Informacja o dostępności” — czekasz na e-mail z magazynu. Sygnały „Brak na stanie” trafiają wyłącznie do działu zakupów.";
