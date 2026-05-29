/** Wspólne opisy ścieżek prośby informacyjnej (panel, magazyn, handlowiec). */

export const INFORMACJA_FLOW_DIRECT = {
  id: "direct" as const,
  label: "Od razu do magazynu",
  short:
    "Bez zamówienia u dostawcy z panelu dziennego — magazyn obserwuje dostępność, potem e-mail do handlowca.",
  steps: ["Zgłoszenie", "Kolejka informacji (magazyn)", "E-mail do handlowca"],
};

export const INFORMACJA_FLOW_VIA_PANEL = {
  id: "via_panel" as const,
  label: "Najpierw zamówienie z panelu Dziś",
  short:
    "Zakupy oznaczają Główne lub Uzupełniające u dostawcy — dopiero potem kolejka informacji i e-mail.",
  steps: [
    "Zgłoszenie",
    "Panel Dziś (Główne / Uzupełniające)",
    "Kolejka informacji (magazyn)",
    "E-mail do handlowca",
  ],
};

export const INFORMACJA_FLOW_LEGEND_PANEL =
  "Informacja bez zamówienia w panelu trafia do Wyjątków i kolejki magazynu. Z opcją „najpierw panel Dziś” — najpierw Prośby handlowców (Główne / Uzupełniające), potem magazyn.";

export const INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER =
  "Prośba informacyjna: po Główne lub Uzupełniające pozycja trafi do kolejki magazynu — nie odkładaj od razu na regał.";

export const INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT = {
  statusTitle: "Czekamy na zamówienie u dostawcy",
  statusDetail:
    "Zakupy zamówią u dostawcy z panelu dziennego (Główne lub Uzupełniające). Potem magazyn przyjmie towar i wyślemy e-mail.",
};

export const INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE = {
  statusTitle: "Zamówione — czekamy na magazyn",
  statusDetail:
    "Dział dostaw złożył zamówienie u dostawcy. Wyślemy e-mail, gdy towar pojawi się na magazynie.",
};

export const INFORMACJA_FLOW_SALES_DIRECT = {
  statusTitle: "Oczekuje na magazyn",
  statusDetail:
    "Nie zamawiamy u dostawcy z panelu. Magazyn obserwuje dostępność — e-mail po przyjęciu towaru.",
};

export const INFORMACJA_FLOW_MY_ORDERS_HINT =
  "Informacja: albo czekasz na zamówienie u dostawcy (panel Dziś), albo tylko na pojawienie się towaru w magazynie.";
