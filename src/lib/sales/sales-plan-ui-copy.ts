/**
 * Teksty Harmonogramu handlowców (/plan) — spójna, zrozumiała polszczyzna.
 * Terminologia: „dział zakupów” (nie „dział dostaw”); prośba ≠ zamówienie u dostawcy.
 */

export const SALES_PLAN_COPY = {
  pageTitle: "Harmonogram",
  headerHint:
    "Pokazuje, kiedy dział zakupów zamawia u dostawcy i kiedy towar zwykle trafia na magazyn — przy Twoich otwartych prośbach oraz w wyszukiwarce.",
  headerHintAria: "O harmonogramie",

  helpLabel: "Pomoc — Harmonogram",
  helpTitle: "Harmonogram",
  helpShort: "Pomoc",
  helpTwoDatesTitle: "Dwie daty",
  helpTwoDatesBody:
    "„Zamówienie” to dzień, w którym dział zakupów składa zamówienie u dostawcy. „Na magazynie” to orientacyjny termin z historii dostaw (dni robocze) — nie gwarancja odbioru.",
  helpOpenTitle: "Dostawcy z otwartymi prośbami",
  helpOpenBody:
    "Lista dostawców, u których masz aktywne prośby w „Moje zamówienia”. Rozwiń wiersz, aby zobaczyć terminy, urlop dostawcy i kontakt.",
  helpSearchTitle: "Wyszukiwarka",
  helpSearchBody:
    "Szukasz wśród wszystkich aktywnych dostawców po fragmencie nazwy — także tych, którzy już są na liście z prośbami.",
  helpWeekTitle: "Kalendarz działu zakupów",
  helpWeekBody:
    "Poniedziałek–piątek: dni składania zamówień u dostawców. Domyślnie widać Twoich dostawców; możesz przełączyć na wszystkich albo na następny tydzień. To nie jest kalendarz urlopów handlowców.",

  searchVisibleLabel: "Szukaj dostawcy",
  searchAriaLabel: "Szukaj dostawcy w harmonogramie",
  searchPlaceholder: "Wpisz fragment nazwy dostawcy",
  searchEmptyHint:
    "Nie ma dostawcy o takiej nazwie — sprawdź pisownię albo wyczyść filtr.",
  searchSectionTitle: "Wyniki wyszukiwania",
  searchSectionHint: (q: string) => `Dla zapytania „${q}”`,
  searchLimitNote: (shown: number, total: number) =>
    `Pokazano pierwsze ${shown} z ${total} dopasowań.`,
  searchNotFoundTitle: "Nie znaleziono dostawcy",
  searchNotFoundBody: "Sprawdź pisownię albo wpisz krótszy fragment nazwy.",
  searchBackToList: "Wróć do listy z otwartymi prośbami",

  openSectionTitle: "Dostawcy z otwartymi prośbami",
  openSectionHint:
    "Ci sami dostawcy, u których masz otwarte prośby w „Moje zamówienia”. Kliknij wiersz, aby zobaczyć szczegóły.",
  openEmptyTitle: "Brak otwartych prośb",
  openEmptyBody:
    "Gdy zgłosisz prośbę, dostawca pojawi się tutaj wraz z planowanym terminem zamówienia i szacunkiem daty na magazynie. Innego dostawcę wyszukasz powyżej.",

  colSupplier: "Dostawca",
  colOrder: "Zamówienie",
  colWarehouse: "Na magazynie",

  labelOnDemand: "Na żądanie",
  labelOverdue: "Po terminie",
  labelOutsideWeek: "Poza tym tygodniem",
  labelNoDate: "Brak terminu",
  labelShifted: "Przesunięty termin",
  labelVacationShort: "Urlop",
  mobileWarehouseEmpty: "magazyn —",

  tipOnDemand:
    "Bez stałego dnia zamówienia — szacunek terminu pojawi się po złożeniu zamówienia",
  tipNoOrderDate: "Brak terminu zamówienia u dostawcy",
  tipNoHistory: "Brak historii dostaw — nie da się oszacować terminu na magazynie",

  expandOrderTitle: "Zamówienie u dostawcy",
  expandWarehouseTitle: "Na magazynie",
  expandIntervalTitle: "Jak często zamawiamy",
  expandVacationTitle: "Urlop dostawcy",
  expandTeethTitle: "Harmonogram zębów",
  expandContactTitle: "Kontakt",
  expandLastOrder: (date: string) => `Ostatnie zamówienie u dostawcy: ${date}`,
  expandActiveShift: "Termin zamówienia został przesunięty w harmonogramie zakupów.",
  expandCycleNote: (note: string) => `Korekta harmonogramu: ${note}`,
  expandOnDemandWarehouse:
    "Bez stałego dnia zamówienia — szacunek terminu po złożeniu zamówienia",
  expandNoHistory: "Brak historii dostaw do wyliczenia szacunku.",
  expandTeethNext: (date: string) => `Kolejne zamówienie zębów: ${date}`,
  expandTeethEta: (eta: string) => ` · szacunek na magazynie: ${eta}`,
  expandTeethNoEta: " · brak szacunku terminu na magazynie",

  ctaMyRequests: (count: number) => `Moje prośby (${count})`,
  ctaNewForSupplier: "Zgłoś prośbę dla tego dostawcy",
  ctaNewForSupplierTitle: (name: string) => `Nowa prośba — ${name}`,
  ctaNewRequest: "Nowa prośba",
  ctaMyOrders: "Moje zamówienia",

  footerAdmin: "Podgląd administratora — nie możesz zgłaszać stąd nowych próśb.",
  footerDefaultPrefix: "Zgłoś nową prośbę albo sprawdź status w ",
  footerDefaultSuffix: ".",

  weekTitle: "Kiedy dział zakupów zamawia",
  weekHint:
    "To dzień złożenia zamówienia u dostawcy — nie dzień, w którym towar trafi na magazyn.",
  weekScopeAria: "Zakres dostawców na kalendarzu",
  weekWhichAria: "Wybór tygodnia",
  weekMine: "Moi dostawcy",
  weekAll: "Wszyscy dostawcy",
  weekThis: "Ten tydzień",
  weekNext: "Następny tydzień",
  weekToday: "Dziś",

  accountLinkHint:
    "Harmonogram zamówień działu zakupów i wyszukiwarka dostawców. Konto musi być przypisane do profilu handlowca.",
  previewTitle: (name: string) => `Harmonogram: ${name}`,
  loading: "Ładowanie…",
} as const;

/** Liczebnik „otwarta prośba / otwarte prośby / otwartych próśb”. */
export function salesPlanOpenRequestsLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "1 otwarta prośba";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} otwarte prośby`;
  }
  return `${n} otwartych próśb`;
}

/** „Masz …” — biernik po „masz”. */
export function salesPlanYouHaveOpenRequests(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return "Masz 1 otwartą prośbę";
  return `Masz ${salesPlanOpenRequestsLabel(n)}`;
}
