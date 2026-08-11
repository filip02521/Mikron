/**
 * Teksty UI szacunku ZD — polszczyzna dla zakupów, bez żargonu API/SQL.
 */

export function zdEstimateHostBadgeLabel(input: {
  isLive: boolean;
  port: number | null;
}): string {
  const port = input.port != null && input.port > 0 ? input.port : null;
  if (input.isLive) {
    return port != null ? `LIVE :${port}` : "LIVE";
  }
  return port != null ? `Test :${port}` : "Test";
}

/** Jedna krótka belka statusu — bez powtórzeń w hintach kart. */
export function zdEstimateHostStripDetail(input: {
  isLive: boolean;
  salesEndFromFs: boolean;
  salesEndKeyFormatted: string | null;
}): string {
  const parts: string[] = [];
  if (input.isLive) {
    parts.push("aktualna baza Subiekta");
  } else {
    parts.push("środowisko testowe Subiekta");
  }
  if (input.salesEndFromFs && input.salesEndKeyFormatted) {
    parts.push(`faktury sprzedaży do ${input.salesEndKeyFormatted}`);
  }
  return parts.join(" · ");
}

export function zdEstimatePageHint(input: {
  isLive: boolean;
  configured: boolean;
}): string {
  if (!input.configured) {
    return "Skonfiguruj połączenie z Subiektem (host szacunku), żeby policzyć listę i utworzyć ZD.";
  }
  const hostNote = input.isLive
    ? "„Utwórz ZD” zapisuje prawdziwy dokument w aktualnej bazie Subiekta."
    : "„Utwórz ZD” idzie na środowisko testowe Subiekta.";
  return `„Do ZD” = jednostki dokumentu (opakowania i prośby). Opakowania, wykluczenia, „tylko na prośbę”, pary i składy są wspólne dla działu. ${hostNote}`;
}

export function zdEstimatePrepCardHint(): string {
  return "Wykluczenia, „tylko na prośbę”, opakowania, pary i składy są trwałe i wspólne dla działu zakupów.";
}

export function zdEstimateEmptyListDescription(isLive: boolean): string {
  const host = isLive
    ? "aktualnej bazy Subiekta"
    : "testowego Subiekta";
  return `Wybierz zakres (grupę albo cechę) i kliknij „Policz listę”. Dane pochodzą z ${host} — pełny zakres towarów.`;
}

export function zdEstimateLaunchFetchHint(isLive: boolean): string {
  return isLive
    ? "Pobieram pełny zakres z aktualnej bazy Subiekta…"
    : "Pobieram pełny zakres z testowego Subiekta…";
}

export function zdEstimateBlockedDailyCtaMessage(): string {
  return "Szacunek jest zablokowany (brak połączenia z Subiektem). CTA z panelu dziennego nie uruchomi listy — ustaw host szacunku w konfiguracji i odśwież stronę.";
}

export function zdEstimateBlockedOrdersAlertBody(message: string | null): string {
  return (
    message?.trim() ||
    "Brak połączenia z hostem szacunku Subiekta (live lub test). Skontaktuj się z administratorem albo sprawdź konfigurację środowiska."
  );
}

export function zdEstimateReadyFollowUp(isLive: boolean): string {
  return isLive
    ? "Użyj „Utwórz ZD” (aktualna baza — prawdziwy dokument) albo skopiuj TSV. „Powiąż ZD” tylko gdy dokument powstał poza OnTime."
    : "Użyj „Utwórz ZD” (test) albo skopiuj TSV. „Powiąż ZD” tylko gdy dokument powstał poza OnTime.";
}

export function zdEstimateCreateTitleHint(input: {
  isLive: boolean;
  port: number;
}): string {
  if (input.isLive) {
    return `Dokument powstanie w aktualnej bazie Subiekta (:${input.port}). Nie da się cofnąć z OnTime. Po sukcesie odznaczymy włączone prośby katalogowe jako Główne (prośby zębów zostają w uwagach).`;
  }
  return `Dokument powstanie w testowym Subiekcie (:${input.port}). Nie da się cofnąć z OnTime. Termin realizacji ustawisz w Subiekcie. Po sukcesie odznaczymy włączone prośby katalogowe jako Główne.`;
}

export function zdEstimateCreateConfirmLabel(input: {
  isLive: boolean;
  port: number;
  markCount: number;
}): string {
  const base = input.isLive
    ? `Potwierdzam utworzenie ZD w aktualnej bazie Subiekta (:${input.port}). Operacji nie da się cofnąć z OnTime`
    : `Potwierdzam utworzenie ZD w testowym Subiekcie (:${input.port}). Operacji nie da się cofnąć z OnTime`;
  const mark =
    input.markCount > 0
      ? " — włączone prośby katalogowe zostaną odznaczone jako Główne"
      : "";
  return `${base}${mark}.`;
}

/** Legenda jednostek nad tabelą wyniku. */
export const ZD_ESTIMATE_UNITS_LEGEND =
  "Jednostki: Sprzed. / Cel / Dost. = sztuki. Do ZD = jednostki dokumentu (op. przy opakowaniu). Otwarte ZD = jednostki dokumentu (przy opakowaniu poniżej także w sztukach).";

export const ZD_ESTIMATE_UI = {
  policzNeedsSettingsTitle:
    "Wymaga wczytanych wykluczeń, „tylko na prośbę”, opakowań, par, składów i katalogu zębów",
  createGateNeedsSettings:
    "Najpierw wczytaj wykluczenia, listę „tylko na prośbę”, opakowania, pary, składy i katalog zębów.",
  createProgressDisclaimer:
    "Postęp jest szacunkowy (bez podglądu kroków po stronie Subiekta) — lista może zostać dłużej na „Tworzenie w Subiekcie”.",
  createQtyBumpNote:
    "Po utworzeniu serwer może podbić ilość na pozycjach, żeby pokryć rezerwę próśb handlowców (zaokrąglenie opakowania w górę).",
  createTeethNote:
    "Prośby zębów trafiają do uwag dokumentu i nie są odznaczane jako Główne z tego ekranu.",
  pairCoverLabel: "pokrycie",
  packagingConflictShort: "Konflikt opakowania",
  packagingConflictTitle:
    "Opakowanie w OnTime różni się od przelicznika pary — sprawdź ustawienia przed utworzeniem ZD.",
  emptyOrderTitle: "Brak pozycji do ZD",
  emptyExcludedTitle: "Brak wykluczeń w tym zakresie",
  emptyExcludedDescription:
    "Żaden produkt nie jest wykluczony ręcznie, automatycznie (outlet / wycofane / zęby) ani „tylko na prośbę” bez aktywnej prośby.",
  excludedFilterTitle:
    "Hard + auto + tylko na prośbę bez aktywnej prośby. Z prośbą — w Do ZD (qty = prośba).",
  advancedZapasMinLabel: "Bufor minimum (szt.)",
  advancedZapasMinHint: "Dodatkowy zapas minimum doliczany do celu.",
  onRequestVsHardExclude:
    "„Tylko na prośbę” — poza Do ZD bez prośby; z prośbą qty = tylko prośba. Twarde wykluczenie — prośba trafia do usług/uwag.",
} as const;
