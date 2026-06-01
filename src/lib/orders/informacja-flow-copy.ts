/** Wspólne opisy ścieżek prośby informacyjnej (panel zakupów, magazyn, handlowiec). */

export const INFORMACJA_FLOW_DIRECT = {
  id: "direct" as const,
  label: "Od razu do magazynu",
  short:
    "Bez zamówienia u dostawcy — magazyn obserwuje dostępność, potem e-mail do handlowca.",
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

/** Etykieta na pozycji w panelu Dziś (ścieżka: magazyn sprawdza, potem informacja dla handlowca). */
export const INFORMACJA_VIA_PANEL_BADGE = "Magazyn → info";

export const INFORMACJA_VIA_PANEL_STATUS_TITLE = INFORMACJA_VIA_PANEL_BADGE;

export const INFORMACJA_FLOW_LEGEND_PANEL =
  "Informacja bez wcześniejszego zamówienia trafia do Wyjątków i kolejki magazynu. Z opcją „najpierw zamówienie u dostawcy” — najpierw Prośby handlowców (Główne / Uzupełniające), potem magazyn.";

/** Krótki opis pod pozycją w panelu Dziś (szczegóły ścieżki: badge + legenda). */
export const INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER = "Prośba informacyjna.";

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
  statusTitle: "Oczekuje na magazyn",
  statusDetail:
    "Nie składamy zamówienia u dostawcy — magazyn obserwuje dostępność. E-mail po przyjęciu towaru.",
};

export const INFORMACJA_FLOW_MY_ORDERS_HINT =
  "Albo czekasz, aż zakupy zamówią u dostawcy, albo tylko na pojawienie się towaru na magazynie — bez zamówienia u dostawcy.";
