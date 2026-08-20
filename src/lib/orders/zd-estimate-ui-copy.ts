/**
 * Teksty UI kreatora ZD — polszczyzna dla zakupów, bez żargonu API/SQL.
 */

import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { formatZdEstimateElapsedCompact } from "@/lib/orders/zd-estimate-loading-ui";

/** Krótki flow w intro — ten sam na loadingu i stronie (bez skoku copy). */
export const ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION =
  "Zakres Subiekta → lista do zamówienia → Utwórz ZD.";

/** Lead pod tytułem na stronie kreatora (pełniejsze zdanie niż strzałki w loadingu). */
export function zdEstimatePageLead(): string {
  return "Wybierz zakres w Subiekcie, policz listę Do ZD i utwórz dokument — w jednym miejscu.";
}

/** Kroki w nagłówku strony (wizualna mapa flow). */
export function zdEstimatePageFlowSteps(): readonly {
  id: string;
  label: string;
  hint: string;
}[] {
  return [
    {
      id: "scope",
      label: "Zakres",
      hint: "Wybierz grupę albo cechę towarów w Subiekcie",
    },
    {
      id: "list",
      label: "Lista Do ZD",
      hint: "Policz ilości, które trafią na dokument",
    },
    {
      id: "create",
      label: "Utwórz ZD",
      hint: "Zapisz dokument zamówienia w Subiekcie",
    },
  ];
}

/** Kontekst wejścia z panelu / podsumowania. */
export function zdEstimatePageContextFromSupplier(
  supplierName: string | null | undefined
): string | null {
  const name = supplierName?.trim();
  if (!name) return null;
  return `Dostawca: ${name}`;
}

/**
 * Polska odmiana liczebnikowa (1 / 2–4 / 5+ z wyjątkami 12–14).
 * `one` = mianownik lub biernik liczby pojedynczej zależnie od kontekstu.
 */
export function zdEstimatePlCountWord(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const n = Math.abs(Math.trunc(Number(count) || 0));
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** „prośba” / „prośby” / „próśb” (mianownik 1). */
export function zdEstimateProsbaWord(count: number): string {
  return zdEstimatePlCountWord(count, "prośba", "prośby", "próśb");
}

/** „prośbę” / „prośby” / „próśb” (biernik 1 — „wczytano N …”). */
export function zdEstimateProsbaWordAccusative(count: number): string {
  return zdEstimatePlCountWord(count, "prośbę", "prośby", "próśb");
}

export function zdEstimateSnapshotsFooterCount(count: number): string {
  return `${count} ${zdEstimatePlCountWord(
    count,
    "powiązanie",
    "powiązania",
    "powiązań"
  )}`;
}

export function zdEstimateSnapshotsLinesCount(count: number): string {
  return `${count} ${zdEstimatePlCountWord(count, "linia", "linie", "linii")}`;
}

export function zdEstimateSupplierScopesFooterCount(count: number): string {
  return `${count} ${zdEstimatePlCountWord(
    count,
    "mapowanie",
    "mapowania",
    "mapowań"
  )}`;
}

export function zdEstimateSuppliersUnmappedBadge(
  count: number,
  opts?: { compact?: boolean }
): string {
  if (opts?.compact) {
    return `${count} bez map.`;
  }
  return `${count} bez mapowania`;
}

export function zdEstimateSuppliersMenuAriaLabel(unmappedCount: number): string {
  const base = ZD_ESTIMATE_UI.suppliersMenuAriaLabel;
  if (unmappedCount <= 0) return base;
  const who = zdEstimatePlCountWord(
    unmappedCount,
    "dostawca z Dziś bez mapowania",
    "dostawców z Dziś bez mapowania",
    "dostawców z Dziś bez mapowania"
  );
  return `${base}. ${unmappedCount} ${who}.`;
}

export function zdEstimateSuppliersScopesItemSuffix(
  unmappedCount: number
): string {
  if (unmappedCount <= 0) return "";
  return ` · ${unmappedCount} ${zdEstimatePlCountWord(
    unmappedCount,
    "z Dziś bez mapowania",
    "z Dziś bez mapowania",
    "z Dziś bez mapowania"
  )}`;
}

export function zdEstimateRouteLoadingAriaLabel(): string {
  return "Wczytuję kreator ZD";
}

export function zdEstimateRouteLoadingTitle(): string {
  return "Ładuję ustawienia…";
}

export function zdEstimateRouteLoadingSubtitle(): string {
  return "Ładuję ustawienia działu i połączenie z Subiektem…";
}

/** Hint w oknie route loading — bez założeń LIVE/test (host jeszcze nieznany). */
export function zdEstimateRouteLoadingHint(): string {
  return zdEstimateRouteLoadingSubtitle();
}

export function zdEstimateRouteLoadingFooter(): string {
  return "To nie jest jeszcze liczenie listy — zaraz wybierzesz zakres i klikniesz „Policz listę”.";
}

export function zdEstimateLaunchProgressFooter(): string {
  return "Zostajesz na tym ekranie do końca liczenia — lista pojawi się automatycznie.";
}

export function zdEstimateLaunchProgressCompleteTitle(): string {
  return "Lista gotowa";
}

export function zdEstimateLaunchProgressCompleteHint(): string {
  return "Pokazuję wynik…";
}

export function zdEstimateCreateProgressCompleteTitle(input?: {
  snapshotOk?: boolean | null;
}): string {
  if (input?.snapshotOk === false) return "ZD utworzone";
  return "ZD gotowe";
}

export function zdEstimateCreateProgressTitle(): string {
  return "Tworzę ZD w Subiekcie";
}

export function zdEstimateCreateProgressCompleteHint(input: {
  snapshotOk: boolean | null;
}): string {
  if (input.snapshotOk === false) {
    return "Dokument utworzony — historia nie zapisana (użyj „Powiąż ZD”).";
  }
  return "Zapisuję wynik i zamykam okno…";
}

export function zdEstimateCreateProgressAriaLabel(): string {
  return "Tworzenie dokumentu ZD";
}

export function zdEstimateCreateProgressSnapshotFailedHint(): string {
  return "Historia nie zapisana — użyj „Powiąż ZD”";
}

export function zdEstimateCreateProgressFooterBusy(): string {
  return "Zostajesz na tym ekranie do końca tworzenia — nie zamykaj karty ani okna przeglądarki.";
}

export function zdEstimateCreateProgressFooterLong(): string {
  return "Sfera nadal pracuje — to normalne przy większych listach. Nie zamykaj karty ani okna.";
}

/** Hint belki okna loadingu create — ten sam trop co Policz, plus nota o szacunkowym pasku. */
export function zdEstimateCreateProgressWindowHint(input: {
  isLive: boolean;
  configured?: boolean;
}): string {
  return [
    zdEstimatePageHint({
      isLive: input.isLive,
      configured: input.configured ?? true,
    }),
    ZD_ESTIMATE_UI.createProgressDisclaimer,
  ].join("\n\n");
}

/** Stopka create: szacunek czasu + „zostań na ekranie”; po 45s — nota o Sferze. */
export function zdEstimateCreateProgressFooterNote(input: {
  elapsedMs: number;
  durationHint: string;
}): string {
  if (input.elapsedMs >= 45_000) return zdEstimateCreateProgressFooterLong();
  const duration = input.durationHint.trim();
  const busy = zdEstimateCreateProgressFooterBusy();
  return duration ? `${duration} ${busy}` : busy;
}

export function zdEstimateLoadingBusyDetailProgress(): string {
  return "postęp szacunkowy";
}

export function zdEstimateLoadingBusyDetailRoute(): string {
  return "wczytywanie ustawień";
}

export function zdEstimateLoadingBusyDetailSessionResume(): string {
  return "przywracanie sesji";
}

/**
 * Route loading przy powrocie do zapisanej sesji (resume=1 / token away).
 * Inne copy niż pierwsze wejście — nie sugerujemy „nowego” kreatora.
 */
export function zdEstimateSessionResumeRouteLoadingAriaLabel(): string {
  return "Wznawiam sesję kreatora ZD";
}

export function zdEstimateSessionResumeRouteLoadingTitle(): string {
  return "Wracam do sesji…";
}

export function zdEstimateSessionResumeRouteLoadingHint(): string {
  return "Przywracam zapisaną listę i Twoje zmiany — to nie jest ponowne liczenie.";
}

export function zdEstimateSessionResumeRouteLoadingFooter(): string {
  return "Kontynuujesz poprzednią pracę. „Policz listę” uruchomisz tylko wtedy, gdy sam tego chcesz.";
}

export function zdEstimateSessionResumeRouteLoadingSteps(): ReadonlyArray<{
  id: string;
  title: string;
  activeHint: string;
  doneHint: string;
}> {
  return [
    {
      id: "open",
      title: "Otwieram kreator",
      activeHint: "Wchodzę tam, gdzie skończyłeś…",
      doneHint: "Kreator gotowy",
    },
    {
      id: "snapshot",
      title: "Wczytuję zapis sesji",
      activeHint: "Pobieram snapshot listy z serwera…",
      doneHint: "Snapshot wczytany",
    },
    {
      id: "restore",
      title: "Przywracam widok",
      activeHint: "Składam listę, filtry i zmiany…",
      doneHint: "Możesz kontynuować",
    },
  ];
}

/** Panel w workbenchu podczas restoreExternalSession. */
export function zdEstimateSessionResumeProgressTitle(input: {
  returningFromAway: boolean;
}): string {
  return input.returningFromAway
    ? "Wracam do sesji kreatora…"
    : "Przywracam sesję…";
}

export function zdEstimateSessionResumeProgressCompleteTitle(): string {
  return "Sesja gotowa";
}

export function zdEstimateSessionResumeProgressCompleteHint(): string {
  return "Pokazuję zapisaną listę…";
}

export function zdEstimateSessionResumeProgressFooter(): string {
  return "To nie jest nowe liczenie — wracasz do poprzedniego wyniku „Policz”.";
}

export function zdEstimateSessionResumeProgressSteps(): ReadonlyArray<{
  id: string;
  title: string;
  activeHint: string;
  doneHint: string;
}> {
  return [
    {
      id: "token",
      title: "Wznawiam timer sesji",
      activeHint: "Zatrzymuję licznik wygaśnięcia…",
      doneHint: "Sesja aktywna w kreatorze",
    },
    {
      id: "fetch",
      title: "Pobieram zapis",
      activeHint: "Wczytuję snapshot z bazy…",
      doneHint: "Snapshot gotowy",
    },
    {
      id: "apply",
      title: "Przywracam listę",
      activeHint: "Odtwarzam pozycje Do ZD i Twoje edycje…",
      doneHint: "Lista przywrócona",
    },
  ];
}

export function zdEstimateSessionResumeScopeChipLabel(
  scopeMode: "grupa" | "cecha"
): string {
  return scopeMode === "cecha" ? "Cecha" : "Grupa";
}

/**
 * Kroki bootstrapu trasy (SSR) — tylko to, co dzieje się przy wejściu,
 * nie kroki „Policz listę” (te są w LaunchProgress po kliknięciu).
 */
export function zdEstimateRouteLoadingSteps(): ReadonlyArray<{
  id: string;
  title: string;
  activeHint: string;
  doneHint: string;
}> {
  return [
    {
      id: "settings",
      title: "Ustawienia działu",
      activeHint: "Wczytuję wykluczenia, opakowania, pary…",
      doneHint: "Ustawienia gotowe",
    },
    {
      id: "host",
      title: "Połączenie z Subiektem",
      activeHint: "Sprawdzam host kreatora…",
      doneHint: "Host ustalony",
    },
    {
      id: "ui",
      title: "Ekran przygotowania",
      activeHint: "Składam formularz zakresu…",
      doneHint: "Możesz wybrać grupę lub cechę",
    },
  ];
}

/** Kroki checklisty „Policz listę” (launch progress). */
export function zdEstimateLaunchProgressSteps(input: {
  isLive: boolean;
  scopeAlreadyResolved: boolean;
}): ReadonlyArray<{
  id: string;
  title: string;
  activeHint: string;
  doneHint: string;
}> {
  return [
    {
      id: "scope",
      title: "Zakres Subiekta",
      activeHint: input.scopeAlreadyResolved
        ? zdEstimateLaunchScopeResolvedHint()
        : zdEstimateLaunchScopePendingHint(),
      doneHint: "Zakres ustawiony",
    },
    {
      id: "fetch",
      title: "Towary i stany",
      activeHint: zdEstimateLaunchFetchHint(input.isLive),
      doneHint: "Dane z Subiekta wczytane",
    },
    {
      id: "calc",
      title: "Sprzedaż, zapas i prośby",
      activeHint: "Analizuję sprzedaż, stany i dołączam prośby handlowców…",
      doneHint: "Wyliczenia i prośby gotowe",
    },
    {
      id: "list",
      title: "Lista do ZD",
      activeHint: "Składam pozycje „Do ZD”…",
      doneHint: "Lista gotowa",
    },
  ];
}

export function zdEstimateScopeDashedHint(mode: "grupa" | "cecha"): string {
  return mode === "grupa"
    ? "Wybierz skrót albo wyszukaj grupę Subiekta — dni zapasu i okno sprzedaży ustawią się automatycznie (z karty dostawcy lub z nazwy)."
    : "Wyszukaj cechę Subiekta — zapas i daty sprzedaży ustawią się z nazwy cechy albo z karty dostawcy w „Zaawansowane”.";
}

export function zdEstimateScopeModeGrupaHint(): string {
  return "Zakres = grupa towarów z katalogu Subiekta (najczęstszy wybór przy dostawcy).";
}

export function zdEstimateScopeModeCechaHint(): string {
  return "Zakres = cecha towarów — może łączyć towary z wielu grup (np. marka lub linia).";
}

export function zdEstimateReadyToCountHint(): string {
  return "Zakres gotowy — kliknij „Policz listę”, żeby wyliczyć ilości Do ZD.";
}

export function zdEstimateScopeKindLabel(mode: "grupa" | "cecha"): string {
  return mode === "cecha" ? "Cecha" : "Grupa";
}

export function zdEstimateScopeLinkedTitle(mode: "grupa" | "cecha"): string {
  return mode === "cecha" ? "Wybrana cecha" : "Wybrana grupa";
}

export function zdEstimateScopeLinkedCaption(): string {
  return "Powiązano z Subiektem — możesz policzyć listę Do ZD.";
}

export function zdEstimateScopeChangedHint(): string {
  return "Zmieniono zakres — policz listę ponownie, żeby odświeżyć ilości Do ZD.";
}

export function zdEstimateNeedsSettingsHint(): string {
  return "Najpierw wczytaj ustawienia działu (komunikat pod tą kartą albo „Spróbuj ponownie” w banerze), potem kliknij „Policz listę”.";
}

/** Jedna linia pod trybem Cecha. */
export function zdEstimateCechaScopeCaption(): string {
  return "Cecha może łączyć towary z wielu grup katalogowych. Dni zapasu bierzemy z nazwy cechy albo z dostawcy wskazanego w „Zaawansowane”.";
}

/** HelpHint przy sekcji polityk liczenia. */
export function zdEstimatePoliciesSectionHint(): string {
  return "Te ustawienia decydują, ile sztuk trafi do kolumny „Do ZD”. Podbicie reaguje na tempo sprzedaży — po zmianie trzeba ponownie „Policz listę”. Reguła próśb odświeża ilości od razu, bez ponownego liczenia całego zakresu.";
}

export function zdEstimateLaunchProgressTitle(input: {
  manualWithScope: boolean;
}): string {
  return input.manualWithScope
    ? "Liczę listę do ZD…"
    : "Przygotowuję zamówienie ZD";
}

export function zdEstimateLaunchScopeResolvedHint(): string {
  return "Zakres potwierdzony";
}

export function zdEstimateLaunchScopePendingHint(): string {
  return "Potwierdzam grupę lub cechę…";
}

export function zdEstimateRecountOverlayMessage(): string {
  return "Przeliczam listę Do ZD";
}

export function zdEstimateRecountOverlayHint(isLive: boolean): string {
  const host = isLive
    ? "Pobieram świeże dane z aktualnej bazy Subiekta"
    : "Pobieram świeże dane z testowego Subiekta";
  return `${host}. Edycja i „Utwórz ZD” są wstrzymane — ilości mogą się zmienić.`;
}

export function zdEstimateRecountListStatus(input: {
  doZamowieniaCount: number;
  durationMs?: number | null;
}): string {
  const secs =
    input.durationMs != null && input.durationMs >= 0
      ? ` · ${(input.durationMs / 1000).toFixed(1)} s`
      : "";
  return `Przeliczono — ${input.doZamowieniaCount} pozycji do ZD${secs}`;
}

export function zdEstimateCountingButtonLabel(): string {
  return "Przeliczam…";
}

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
    return "Aby policzyć listę i utworzyć dokument ZD, potrzebne jest połączenie z Subiektem (host kreatora). Poproś administratora o konfigurację albo sprawdź ustawienia środowiska.";
  }
  const hostNote = input.isLive
    ? "„Utwórz ZD” zapisuje prawdziwy dokument w aktualnej bazie Subiekta — operacji nie cofniesz z OnTime."
    : "„Utwórz ZD” zapisuje dokument w środowisku testowym Subiekta — bez wpływu na produkcyjną bazę.";
  return `Kolumna „Do ZD” to jednostki na dokumencie (przy paczce — liczba opakowań lub sztuk według trybu). Wykluczenia, „tylko na prośbę”, opakowania, pary i składy są wspólne dla całego działu zakupów. ${hostNote}`;
}

export function zdEstimatePrepCardHint(): string {
  return "Tu wybierasz zakres z Subiekta (grupę albo cechę) i zasady liczenia. Reguły listy oraz mapowania dostawców są wspólne dla działu — zmiana dotyczy wszystkich użytkowników zakupów i obowiązuje przy każdym „Policz listę”.";
}

/** Lead karty zakresu — start i zmiana grupy / cechy przy już wczytanej liście. */
export function zdEstimatePrepIdleLead(): string {
  return "Wybierz skrót grupy albo wyszukaj inną w Subiekcie. Dni zapasu i okno sprzedaży ustawią się z karty dostawcy.";
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
  return "Kreator ZD jest zablokowany (brak połączenia z Subiektem). CTA z panelu dziennego nie uruchomi listy — ustaw host kreatora w konfiguracji i odśwież stronę.";
}

export function zdEstimateBlockedOrdersAlertBody(message: string | null): string {
  return (
    message?.trim() ||
    "Brak połączenia z hostem kreatora ZD Subiekta (live lub test). Skontaktuj się z administratorem albo sprawdź konfigurację środowiska."
  );
}

/** Tytuł toastu po pierwszym Policz z Dziś / podsumowania. */
export function zdEstimateLaunchReadyToastTitle(): string {
  return "Lista gotowa";
}

/**
 * Treść toastu — wynik + jedna linia co dalej (bez wykładu o Powiąż ZD).
 * Odmiana: 1 pozycja / 2–4 pozycje / 5+ pozycji.
 */
export function zdEstimateLaunchReadyToastDescription(input: {
  doZamowieniaCount: number;
  pendingIndividualsCount?: number;
  isLive: boolean;
}): string {
  const n = Math.max(0, Math.trunc(Number(input.doZamowieniaCount) || 0));
  const posWord = zdEstimatePlCountWord(n, "pozycja", "pozycje", "pozycji");
  const bits = [`${n} ${posWord} do ZD`];
  const pending = Math.max(
    0,
    Math.trunc(Number(input.pendingIndividualsCount) || 0)
  );
  if (pending > 0) {
    bits.push(
      `${pending} ${zdEstimateProsbaWordAccusative(pending)}`
    );
  }
  const next = input.isLive
    ? "Utwórz ZD w aktualnej bazie albo skopiuj TSV."
    : "Utwórz ZD (test) albo skopiuj TSV.";
  return `${bits.join(" · ")}. ${next}`;
}

export function zdEstimateCreateTitleHint(input: {
  isLive: boolean;
  port: number;
}): string {
  if (input.isLive) {
    return `Dokument powstanie w aktualnej bazie Subiekta (:${input.port}). Nie da się cofnąć z OnTime. Po sukcesie w panelu po utworzeniu na tej stronie zdecydujesz, czy odznaczyć prośby jako Główne i czy oznaczyć plan jako złożony.`;
  }
  return `Dokument powstanie w testowym Subiekcie (:${input.port}). Nie da się cofnąć z OnTime. Termin realizacji ustawisz w Subiekcie. Po sukcesie w panelu po utworzeniu na tej stronie zdecydujesz, czy odznaczyć prośby i plan.`;
}

export function zdEstimateCreateConfirmLabel(input: {
  isLive: boolean;
  port: number;
  markCount?: number;
}): string {
  const base = input.isLive
    ? `Potwierdzam utworzenie ZD w aktualnej bazie Subiekta (:${input.port}). Operacji nie da się cofnąć z OnTime`
    : `Potwierdzam utworzenie ZD w testowym Subiekcie (:${input.port}). Operacji nie da się cofnąć z OnTime`;
  const follow =
    (input.markCount ?? 0) > 0
      ? " — po utworzeniu w panelu na tej stronie zdecydujesz, czy odznaczyć prośby i plan"
      : "";
  return `${base}${follow}.`;
}

/** Legenda jednostek nad tabelą wyniku. */
export const ZD_ESTIMATE_UNITS_LEGEND =
  "Jednostki: Dost. / Sprzed. / Cel = zawsze sztuki (przybliżenie w op. tylko w podpowiedzi po najechaniu). Kolumna Opak. = ile sztuk w 1 na ZD (kliknij, żeby edytować). Do ZD = jednostki dokumentu (paczki albo sztuki według trybu; przy paczkach pod spodem → ile sztuk przyjdzie). Otwarte = jednostki dokumentu.";

export const ZD_ESTIMATE_UI = {
  policzNeedsSettingsTitle:
    "Wymaga wczytanych wykluczeń, „tylko na prośbę”, opakowań, par, składów i katalogu zębów",
  createGateNeedsSettings:
    "Najpierw wczytaj wykluczenia, listę „tylko na prośbę”, opakowania, pary, składy i katalog zębów.",
  createGateEstimating:
    "Trwa przeliczanie listy Do ZD — poczekaj, zanim utworzysz dokument (ilości mogą się zmienić).",
  createGateMutating: "Trwa inna operacja — poczekaj na zakończenie.",
  createGateExplodeBomIncomplete:
    "Skład w trybie „Składamy” jest niekompletny (brak towarów w wyniku) — dociągnij brakujące pozycje („Policz listę”), zanim utworzysz ZD.",
  createGatePendingIndividualsError:
    "Nie wczytano próśb handlowców — wczytaj ponownie albo przelicz listę, zanim utworzysz ZD (mogłyby wejść dopiero przy zapisie).",
  createGatePendingIndividualsTruncated:
    "Wczytano tylko pierwsze 500 próśb — odznacz zbędne w panelu Dziś, zanim utworzysz ZD.",
  createGatePendingIndividualsLoading:
    "Wczytuję prośby handlowców — poczekaj, zanim utworzysz ZD.",
  createGateHistoryFetchFailed:
    "Nie wczytano historii zamówień ZD — przelicz listę, zanim utworzysz dokument (korekty z historii mogły nie wejść).",
  historyFetchFailedTitle: "Nie wczytano historii zamówień ZD",
  historyFetchFailedBody:
    "Lista Do ZD poszła bez korekt z zapisanych dokumentów (cięcia przy wolnej sprzedaży / skoku). Przelicz listę, zanim utworzysz ZD — inaczej ilości mogą być zawyżone.",
  historyFetchFailedCta: "Policz ponownie",
  createProgressDisclaimer:
    "Postęp jest szacunkowy (Subiekt nie pokazuje kroków na bieżąco) — lista może dłużej zostać na „Tworzenie w Subiekcie”.",
  createQtyBumpNote:
    "Po utworzeniu serwer może podbić ilość na pozycjach, żeby pokryć rezerwę próśb handlowców (zaokrąglenie opakowania w górę).",
  createTeethNote:
    "Prośby zębów trafiają do uwag dokumentu i nie są odznaczane jako Główne z tego ekranu.",
  createAfterSuccessDecide:
    "Po utworzeniu ZD w panelu na tej stronie zdecydujesz, czy odznaczyć prośby jako Główne i czy oznaczyć planowane zamówienie jako złożone.",
  createAfterSuccessDecideNoGlowne:
    "Po utworzeniu ZD w panelu na tej stronie możesz oznaczyć planowane zamówienie jako złożone (osobno od Główne).",
  packagingConflictTitle:
    "Opakowanie w OnTime różni się od przelicznika pary — sprawdź ustawienia przed utworzeniem ZD.",
  createOmittedServicesHint:
    "Usuń część usług z limitu uwag albo obsłuż je w panelu Dziś (skrócenie samej bazy uwag nie wpuszcza pominiętych usług).",
  implicitPieceSnapshotTitle:
    "Historia zapisze jednostki ZD jako sztuki 1:1",
  implicitPieceSnapshotBody:
    "Jeśli towar idzie w paczkach, ustaw opakowanie (≥2 szt/op.) albo parę zanim zapiszesz ZD. Inaczej kolejne szacunki potraktują zapisane ilości jako sztuki.",
  implicitPieceSnapshotContinueHint:
    "Jeśli te towary idą na sztuki, możesz kontynuować bez zmian.",
  implicitPieceSnapshotOpenPackagingCta: "Ustaw opakowania",
  implicitPieceSnapshotOpenPairsCta: "Ustaw pary",
  emptyOrderTitle: "Brak pozycji do ZD",
  emptyExcludedTitle: "Brak wykluczeń w tym zakresie",
  emptyExcludedDescription:
    "Żaden produkt nie jest wykluczony ręcznie, automatycznie (outlet / wycofane / zęby) ani „tylko na prośbę” bez aktywnej prośby.",
  excludedFilterTitle:
    "Wykluczenia ręczne i automatyczne oraz „tylko na prośbę” bez aktywnej prośby. Z aktywną prośbą pozycja wraca do Do ZD w ilości z prośby.",
  listFilterOrderTitle:
    "Pozycje z ilością Do ZD większą od zera — bez wykluczonych z listy zamówienia",
  listFilterAllTitle:
    "Cały zakres z Subiekta, także zerowe Do ZD; wykluczone widać z oznaczeniem",
  /** Title filtra „Wszystkie” z liczbą pozycji w zakresie Subiekta. */
  listFilterAllTitleWithCount: (inScopeCount: number) =>
    `Cały zakres z Subiekta (${inScopeCount} pozycji), także zerowe Do ZD; wykluczone widać z oznaczeniem`,
  listFilterReviewTitle:
    "Pozycje z wątpliwym podbiciem Do ZD (niska lub średnia pewność sprzedaży) — warto sprawdzić przed utworzeniem dokumentu",
  listShowStockDetailTitle:
    "Dodatkowe kolumny: stan magazynowy i rezerwacje (obok kolumny Dostępne)",
  listShowZkColumnTitle:
    "Kolumny diagnostyczne: otwarte ZK oraz surowe ilości z Subiekta — zwykle zbędne przy codziennym zamawianiu",
  listSortByConfidence: "Sortuj po pewności",
  listColumnMenuLabel: "Kolumny listy",
  listColumnToggleHint: "Włącz / wyłącz kolumnę — zapisuje się w profilu",
  listColumnOrderHint: "Zmień kolejność kolumn na liście",
  listColumnMoveUp: "Przesuń w górę (wcześniej na liście)",
  listColumnMoveDown: "Przesuń w dół (później na liście)",
  listColumnReset: "Przywróć domyślne kolumny",
  listColumnAlwaysVisibleHint:
    "Symbol, Nazwa, Do ZD i Akcje są zawsze widoczne; Opak. jest przed Do ZD",
  listColumnLabels: {
    packaging: "Opakowanie",
    status: "Status",
    stock: "Stan / rezerwacje",
    available: "Dostępne",
    sales: "Sprzedaż",
    target: "Cel zapasu",
    openZd: "Otwarte ZD",
    zk: "ZK / Subiekt",
  } satisfies Record<
    import("@/lib/orders/zd-estimate-prefs").ZdEstimateOptionalColumn,
    string
  >,
  listSelectVisible: (count: number) => `Zaznacz widoczne (${count})`,
  listSelectVisibleTitle:
    "Zaznacza wszystkie pozycje aktualnie widoczne na liście (filtr + szukanie)",
  listMoreMenuLabel: "Ustawienia listy (kolumny, sortowanie, zaznaczenie)",
  listFilterReviewShort: "Weryfikacja",
  listFilterExcludedShort: "Wykluczone",
  listSortSymbolHint:
    "Sortowanie po symbolu Subiekta (A→Z). Osobna kolumna — sticky przy przewijaniu.",
  listSortNameHint:
    "Sortowanie po nazwie towaru (A→Z). Osobna kolumna — sticky przy przewijaniu.",
  listStatusColumnHint:
    "Chipy statusu (para / prośba / skład / wykluczenie) — do 4 w rzędzie, potem +N. Szczegóły w podpowiedzi (hover).",
  doZdColumnHint:
    "Ilość na dokumencie ZD. Przy paczkach: liczba opakowań (+ ile sztuk przyjdzie pod spodem). Pod ilością: % pewności podbicia — amber + OK = do weryfikacji (klik zaakceptuj w tej sesji; OK zostaje też przy nadpisaniu / zaokrągleniu opakowań). Definicja opakowania — kolumna Opak. obok.",
  advancedZapasMinLabel: "Bufor minimum (szt.)",
  advancedZapasMinHint:
    "Dodatkowe sztuki doliczane do celu zapasu przed wyliczeniem Do ZD. Podnoszą „bezpieczny” poziom magazynu niezależnie od okna sprzedaży.",
  advancedSupplierOverrideHint:
    "Wymusza kartę dostawcy (dni zapasu, skróty, mapa zakresu) zamiast domyślnego z grupy lub cechy. Przydatne, gdy cecha łączy kilka marek.",
  advancedDniZapasuHint:
    "Na ile dni sprzedaży budujemy cel zapasu. Po zmianie okno „Data od / do” przelicza się automatycznie (chyba że ustawisz daty ręcznie).",
  advancedDataOdHint:
    "Początek okna sprzedaży z Subiekta. Ręczna zmiana blokuje automatyczne daty z dni zapasu.",
  advancedDataDoHint:
    "Koniec okna sprzedaży (zwykle ostatni dzień z faktur). Ręczna zmiana blokuje automatyczne daty z dni zapasu.",
  advancedSalesWindowManualNote:
    "Okno sprzedaży ustawione ręcznie — daty nie nadpiszą się automatycznie z zapasu dostawcy ani z nazwy grupy.",
  boostPowerLabel: "Podbicie Do ZD",
  boostPowerAriaLabel:
    "Jak mocno tempo sprzedaży podnosi ilość w kolumnie Do ZD",
  boostNeedsRecountTitle: "Zmieniono podbicie sprzedaży",
  boostNeedsRecountBody:
    "Lista Do ZD powstała przy poprzedniej sile podbicia. Przelicz listę, zanim utworzysz dokument — ilości mogą się zmienić.",
  boostNeedsRecountCta: "Przelicz z nowym podbiciem",
  createGateBoostNeedsRecount:
    "Zmieniono podbicie sprzedaży — przelicz listę przed utworzeniem ZD.",
  policiesSectionLabel: "Polityki liczenia",
  historyNeedsRecountTitle: "Zmieniono historię powiązań ZD",
  historyNeedsRecountBody:
    "Włączono lub wyłączono zapisane ZD w historii zamówień. Przelicz listę przed utworzeniem dokumentu — korekta z historii mogła się zmienić.",
  historyNeedsRecountCta: "Przelicz z historią",
  createGateHistoryNeedsRecount:
    "Zmieniono historię powiązań ZD — przelicz listę przed utworzeniem ZD.",
  /** Opisy pozycji menu „Reguły listy”. */
  menuExclusionsTitle: "Wykluczenia",
  menuExclusionsDescription:
    "Towary trwale pomijane przy „Policz listę” — nie trafiają do Do ZD, dopóki ich nie przywrócisz.",
  menuOnRequestTitle: "Tylko na prośbę",
  menuOnRequestDescription:
    "Bez prośby handlowca poza listą; z prośbą — Do ZD tylko w ilości z prośby, bez celu zapasu.",
  menuPackagingTitle: "Opakowania",
  menuPackagingDescription:
    "Ile sztuk wchodzi w jedną jednostkę na dokumencie ZD (paczka albo dobicie w sztukach).",
  menuPairsTitle: "Pary",
  menuPairsDescription:
    "Karton kupowany ↔ sztuki sprzedawane: popyt i stan w sztukach, na ZD zamawiasz paczkę.",
  menuBomsDescription:
    "Zestawy i komplety — jak sprzedaż zestawu obciąża składniki i co idzie na dokument ZD.",
  menuRulesGroupLabel: "Jak liczyć Do ZD",
  menuSuppliersGroupLabel: "Mapowania i historia",
  menuScopesDescription:
    "Przypisanie dostawcy do grupy lub cechy Subiekta. Wejście z kolejki Dziś od razu otwiera właściwy zakres.",
  menuSnapshotsDescription:
    "Zapisane dokumenty ZD korygują kolejne szacunki. Wyłącz błędne powiązanie, żeby nie zaniżało list.",
  exclusionsModalTitle: "Wykluczenia ZD",
  exclusionsModalHint:
    "Produkty z tej listy są pomijane przy każdym „Policz listę” — nie pojawiają się w Do ZD. Lista jest wspólna dla całego działu zakupów. To nie to samo co „tylko na prośbę”: twarde wykluczenie blokuje także ścieżkę katalogową z prośbą (prośba może trafić do usług lub uwag).",
  exclusionsIntroTitle: "Trwałe pomijanie przy „Do ZD”",
  exclusionsIntroBody:
    "Dodaj produkt, gdy nie chcesz go zamawiać w kreatorze (np. outlet, wycofanie, błąd katalogu). Przywróć go, gdy znów ma wrócić na listę. Notatka pomaga innym w dziale zrozumieć powód.",
  excludeDialogHint:
    "Produkt zniknie z „Do ZD” przy kolejnych „Policz listę”, aż go przywrócisz. Lista jest wspólna dla działu zakupów.",
  bulkExcludeDialogHint:
    "Zaznaczone produkty znikną z „Do ZD” przy kolejnych „Policz listę”. Lista jest wspólna dla działu zakupów.",
  onRequestModalTitle: "Tylko na prośbę",
  onRequestModalHint:
    "Bez aktywnej prośby handlowca produkt zostaje poza Do ZD. Gdy prośba jest, trafia na listę tylko w ilości z prośby — bez doliczania celu zapasu. Lista wspólna dla działu. Nie mylić z „w razie potrzeby” na karcie dostawcy ani z twardym wykluczeniem.",
  onRequestIntroTitle: "Zamawianie tylko przy prośbie",
  onRequestIntroBody:
    "Usuń wpis, gdy produkt ma wrócić do zwykłego liczenia zapasu (tempo sprzedaży + cel magazynowy).",
  pairsModalTitle: "Pary montaż / demontaż",
  pairsModalHint:
    "Łączysz SKU paczki (kupowane na ZD) ze SKU sztuk (sprzedawane). Kreator scala sprzedaż i stany w sztukach, a na dokument zamawia wyłącznie paczkę. Przydatne, gdy w Subiekcie masz osobny towar „karton” i „sztuka”.",
  pairsIntroTitle: "1 paczka = N sztuk (demontaż)",
  pairsIntroBodySeed:
    "Wskaż, który towar to cała paczka (kupowana na ZD), a który pozycja na sztuki — oraz ile sztuk jest w paczce.",
  pairsIntroBodyManual:
    "Dodaj pary ręcznie albo zaznacz 2 towary na liście wyniku i wybierz „Para”. Automatyczny sync kompletów z Subiekta jest niedostępny, dopóki host ORDERS nie udostępni endpointu kompletów.",
  supplierScopesPanelTitle: "Zakresy dostawców",
  supplierScopesPanelHint:
    "Każdy dostawca może mieć jedną przypisaną grupę albo cechę Subiekta. Mapowanie jest wspólne dla działu: z kolejki Dziś kreator otwiera od razu ten zakres, a skróty w formularzu działają spójnie dla wszystkich.",
  supplierScopesIntroTitle: "Jedno mapowanie na dostawcę",
  supplierScopesIntroBody:
    "Gdy handlowiec lub zakupy wchodzą z Dziś przy dostawcy, OnTime wie, którą grupę lub cechę policzyć. Zmiana tutaj obowiązuje cały dział — nie ustawiaj „na próbę” bez uzgodnienia.",
  supplierScopesAddCta: "Dodaj mapowanie",
  supplierScopesAddHint:
    "Wybierz dostawcę bez mapowania, potem wyszukaj i wskaż grupę lub cechę Subiekta.",
  supplierScopesSaveCta: "Zapisz mapowanie",
  supplierScopesCancelCta: "Anuluj",
  supplierScopesEditCta: "Edytuj",
  supplierScopesRemoveCta: "Usuń",
  supplierScopesSearchPlaceholder: "Szukaj dostawcy, etykiety, id…",
  supplierScopesEmptyTitle: "Brak mapowań",
  supplierScopesEmptyDescription:
    "Dodaj mapowanie albo zapisz zakres przy pierwszym wejściu z Dziś — wtedy kolejne wejścia otworzą właściwą grupę lub cechę automatycznie.",
  supplierScopesFilterEmptyTitle: "Brak wyników",
  supplierScopesFilterEmptyDescription:
    "Żadne mapowanie nie pasuje do filtra — wyczyść wyszukiwanie.",
  supplierScopesLoading: "Wczytuję mapowania…",
  supplierScopesPickSupplier: "— wybierz dostawcę —",
  supplierScopesAllMappedTitle: "Wszyscy dostawcy mają już mapowanie",
  supplierScopesSearchGroupPlaceholder: "Szukaj grupy…",
  supplierScopesSearchCechaPlaceholder: "Szukaj cechy…",
  supplierScopesSearchCta: "Szukaj",
  supplierScopesPickedPrefix: "Wybrane",
  supplierScopesUpdatedPrefix: "Aktualizacja",
  supplierScopesAssignCta: "Przypisz",
  supplierScopesOverdueSuffix: "zaległy",
  supplierScopesCloseCta: "Zamknij",
  suppliersMenuTrigger: "Dostawcy",
  suppliersMenuAriaLabel:
    "Dostawcy: przypisanie zakresu Subiekta oraz historia powiązań dokumentów ZD",
  departmentSettingsMenuTrigger: "Reguły listy",
  departmentSettingsMenuTriggerCompact: "Reguły",
  departmentSettingsMenuAriaLabel:
    "Reguły listy Do ZD: wykluczenia, tylko na prośbę, opakowania, pary i składy",
  todayScopeCoverageTitle: "Dziś bez mapowania",
  todayScopeCoverageEmpty: "Wszyscy dostawcy z kolejki Dziś mają przypisany zakres.",
  todayScopeCoverageHint:
    "Przypisz grupę lub cechę, żeby wejście z Dziś od razu otwierało właściwy zakres w kreatorze — bez ręcznego wyszukiwania.",
  snapshotsModalTitle: "Historia powiązań ZD",
  snapshotsModalHint:
    "Po utworzeniu lub powiązaniu ZD zapisujemy linie dokumentu. Przy kolejnym „Policz listę” kreator może skorygować ilości względem tej historii. Ilości są w sztukach. Wyłącz powiązanie, jeśli dokument był błędny albo nie powinien wpływać na szacunki.",
  snapshotsModalSelectHint:
    "Wybierz powiązanie z listy po lewej, aby zobaczyć linie dokumentu i włączyć albo wyłączyć udział w historii.",
  snapshotsModalEmptyTitle: "Brak powiązań",
  snapshotsModalEmptyDescription:
    "Gdy utworzysz ZD w kreatorze albo powiążesz istniejący dokument, pojawi się tu wpis do historii.",
  snapshotsModalLinesEmpty: "Brak linii w tym powiązaniu.",
  snapshotsModalLinesCaption:
    "Ilości w sztukach — na tej podstawie kreator uczy korektę przy następnym „Policz listę”.",
  snapshotsModalLoadErrorTitle: "Nie wczytano historii",
  snapshotsModalListHeading: "Powiązania",
  snapshotsDisableHistoryCta: "Wyłącz z historii",
  snapshotsEnableHistoryCta: "Włącz do historii",
  snapshotsDisabledBadge: "Wyłączony",
  snapshotsScopeLegacy: "Starszy wpis",
  snapshotsHostLive: "LIVE",
  snapshotsHostTest: "Test",
  snapshotsColSymbol: "Symbol",
  snapshotsColName: "Nazwa",
  snapshotsColQty: "Szt.",
  snapshotsColTarget: "Cel",
  snapshotsColDelta: "Δ",
  snapshotsLoadingList: "Wczytuję powiązania…",
  snapshotsLoadingLines: "Wczytuję linie…",
  snapshotsCloseCta: "Zamknij",
  extrasPolicyLabel: "Prośby i niedobór",
  extrasPolicyAriaLabel:
    "Jak łączyć prośby handlowców z niedoborem magazynowym w ilości Do ZD",
  extrasPolicySumShort: "Suma",
  extrasPolicyMaxShort: "Maksimum",
  extrasPolicySumHint:
    "Do ZD = niedobór magazynowy powiększony o rezerwę z próśb. Używaj, gdy prośba ma dojść „na wierzch” niedoboru (często Ivoclar, Falcon).",
  extrasPolicyMaxHint:
    "Do ZD = większa z dwóch wartości: niedobór albo suma próśb. Gdy prośba już pokrywa niedobór, nie dublujemy sztuk.",
  reviewAcceptCta: "Zaakceptuj",
  reviewZeroCta: "Zeruj Do ZD",
  reviewAcceptHint:
    "Zdejmuje oznaczenie „Do weryfikacji” tylko w tej sesji — nie zmienia zapisanej ilości Do ZD.",
  reviewZeroHint:
    "Ustawia Do ZD = 0 na zaznaczonych pozycjach w tej sesji (np. gdy podbicie było zbędne) i zdejmuje „Do weryfikacji”.",
  selectionGroupRelations: "Powiązania",
  selectionGroupUnits: "Jednostki",
  selectionGroupReview: "Weryfikacja",
  createPendingReviewWarn: (count: number) => {
    const n = Math.max(0, Math.trunc(Number(count) || 0));
    const word = zdEstimatePlCountWord(n, "pozycja", "pozycje", "pozycji");
    const verb = n === 1 ? "ma" : "mają";
    const qtyWord = n === 1 ? "ilość" : "ilości";
    return `${n} ${word} nadal ${verb} oznaczenie „Do weryfikacji” (wątpliwe podbicie). Możesz utworzyć ZD — albo wróć do filtra Weryfikacja i zaakceptuj / skoryguj ${qtyWord}.`;
  },
  selectionGroupRules: "Reguły",
  selectionGroupList: "Zakres listy",
  selectionClearLabel: "Odznacz",
  selectionMoreMenuLabel: "Więcej akcji",
  changeSupplierScopeCta: "Zmień dostawcę",
  scopeMenuTrigger: "Zakres",
  scopeMenuAriaLabel: "Zmiana zakresu i dostawcy",
  scopeMenuCollapseItem: "Zwiń przygotowanie",
  scopeMenuExpandItem: "Zmień zakres",
  changeSupplierScopeTitle: "Zmień zakres Subiekta",
  changeSupplierScopeHint:
    "Wskaż inną grupę lub cechę w formularzu, potem „Zapisz zakres i policz”.",
  changeSupplierScopeCancelCta: "Anuluj zmianę",
  assignSupplierScopeTitle: "Przypisz zakres Subiekta",
  onRequestVsHardExclude:
    "„Tylko na prośbę”: bez prośby — poza Do ZD; z prośbą — ilość = tylko prośba. Twarde wykluczenie: produkt nie idzie katalogowo na ZD; prośba może trafić do usług lub uwag dokumentu.",
  postCreateTitleCreated: "ZD utworzone",
  postCreateTitleLinked: "ZD powiązane",
  postCreateTitleTimeout: "Sprawdź wynik tworzenia",
  postCreateModalHint:
    "Podsumowanie po utworzeniu lub powiązaniu ZD: status w Subiekcie, historia, oznaczenia Główne/plan, kontakt i pozycje dokumentu. Zamknięcie okna nie odblokowuje ponownego tworzenia — do tego służą osobne akcje albo „Policz listę”.",
  postCreateDokUnconfirmed: "niepotwierdzony",
  postCreateStatusSubiektOk: "Dokument w Subiekcie",
  postCreateStatusSubiektUnsure: "Dokument w Subiekcie — niepewny (timeout)",
  postCreateStatusHistoryOk: "Historia zapisana",
  postCreateStatusHistoryNeed: "Historia wymaga powiązania",
  postCreateStatusGlowneNone: "Prośby Główne — jeszcze nie odznaczono",
  postCreateStatusGlownePending: "Prośby Główne — czekają na Twoją decyzję",
  postCreateStatusGlowneDone: "Prośby odznaczone jako Główne",
  postCreateStatusGlowneClearedSkipped:
    "Brak próśb do Główne — pominięto (status / zęby / dostawca)",
  postCreateStatusScheduleNone: "Plan tygodnia — bez zmian",
  postCreateStatusSchedulePending: "Plan tygodnia — czekają na Twoją decyzję",
  postCreateStatusScheduleDone: "Plan oznaczony jako złożony",
  postCreateMarksTitle: "Oznaczenia po utworzeniu",
  postCreateMarksTimeoutHint:
    "Oznaczenia próśb i planu będą dostępne po potwierdzeniu dokumentu (powiąż ZD).",
  postCreateMarkGlowneCta: "Oznacz prośby jako Główne",
  postCreateMarkScheduleCta: "Oznacz planowane zamówienie jako złożone",
  postCreateMarkScheduleHint:
    "To samo co „Zamówione” w Dziś: zapisuje dzisiejsze zamówienie planowe i przelicza kolejny termin. Niezależne od Główne.",
  postCreateMarkGlowneHint:
    "Odznacza prośby na tym ZD jako Główne. Nie przesuwa harmonogramu dostawcy — plan oznaczysz osobno.",
  postCreateMarkDzisWarning:
    "Główne w Dziś nadal przesuwa plan. Jeśli oznaczysz plan tutaj, nie klikaj Główne w Dziś na pozostałych prośbach kolejnego dnia — to skoczy interwał.",
  postCreatePreviewScrollHint: "pozycji na dokumencie",
  postCreateSearchPlaceholder: "Filtruj symbol, PLU, nazwę…",
  postCreateMailCta: "Napisz do dostawcy",
  postCreateMailDisabled: "Brak adresu e-mail na karcie dostawcy",
  postCreateDzisCta: "Otwórz w Dziś",
  postCreateLinkHistoryCta: "Powiąż historię",
  postCreateLinkTimeoutCta: "Sprawdź świeże ZD",
  postCreateCopyTsvCta: "Skopiuj TSV",
  postCreateDismissCta: "Zamknij panel po utworzeniu",
  postCreateDismissHint:
    "Zamyka tylko ten panel — tworzenie ZD pozostaje zablokowane do odblokowania albo do „Policz listę”.",
  postCreateNoContact: "Brak kontaktu na karcie dostawcy",
  postCreateCardsLink: "Uzupełnij kontakt",
  postCreateDzisMissingSupplier:
    "Brak tego dostawcy na liście Dziś — otwórz panel ręcznie.",
  postCreateLinkRecoveryHint:
    "Dokończ historię po utworzeniu — wybierz dokument ZD i zapisz powiązanie.",
  postCreateTimeoutLockLabel: "niepotwierdzony (timeout)",
  postCreateTimeoutLockBody:
    "Ostatnie tworzenie ZD mogło się udać w Subiekcie mimo timeoutu. Sprawdź dokument, powiąż historię, przelicz listę albo odblokuj świadomie — unikaj duplikatu.",
  postCreateUnlockCta: "Odblokuj tworzenie ZD",
  postCreateMailComposeCta: "Edytuj i wyślij…",
  postCreateMailComposeTitle: "Wiadomość do dostawcy",
  postCreateMailComposeHint:
    "Otworzy Twój program pocztowy (Outlook / Mail). Nadawca = Twoja skrzynka w tym programie — nie wysyłamy z serwera OnTime.",
  postCreateMailComposeOpen: "Otwórz w programie pocztowym",
  postCreateMailComposeTo: "Do",
  postCreateMailComposeSubject: "Temat",
  postCreateMailComposeBody: "Treść",
  packagingDialogTitle: "Karton / opakowanie",
  packagingDialogHint:
    "Wybierz, jak przeliczać niedobór w sztukach na jednostki dokumentu: paczki na ZD albo sztuki z dobiciem do wielokrotności N.",
  packagingModePackagesLabel: "1 na ZD = N szt (paczki na dokumencie)",
  packagingModePiecesLabel: "Do ZD w sztukach — dobij do wielokrotności N",
  packagingModePackagesHint:
    "Na dokumencie wpisujesz liczbę opakowań (np. 2 przy potrzebie 8 szt. i N = 5).",
  packagingModePiecesHint:
    "Na dokumencie wpisujesz sztuki — system dobija do pełnych paczek (np. 10 przy potrzebie 8 szt. i N = 5).",
  packagingModePairBlockedHint:
    "Na paczce z pary montaż/demontaż dostępny jest tylko tryb opakowań (1 na ZD = N szt).",
  packagingModeBulkPairBlockedHint:
    "Zaznaczenie zawiera paczkę z pary — tryb „dobicie w sztukach” jest niedostępny (tylko opakowania).",
  packagingLiveFlash:
    "Opakowania zaktualizowane — pokrycie i Do ZD przeliczone.",
  packagingModalTitle: "Opakowania ZD",
  packagingModalHint:
    "Ustaw, jak przeliczać niedobór w sztukach na jednostki dokumentu ZD. Tryb A: 1 na ZD = opakowanie (wpisujesz liczbę paczek). Tryb B: Do ZD w sztukach z dobiciem do wielokrotności N. Sztuki 1:1 — usuń opakowanie, nie zapisuj „1”.",
  packagingIntroTitle: "1 na ZD → N sztuk na magazynie i w sprzedaży",
  packagingIntroBody:
    "Kreator liczy niedobór w sztukach. Kolumna „Do ZD” pokazuje jednostki dokumentu: albo liczbę paczek (tryb A), albo sztuki dobite do pełnego N (tryb B). Możesz też edytować opakowanie z wiersza listy wyniku.",
  packagingUnitsLabel: "Sztuk w 1 na ZD / wielokrotność",
  packagingUnitsHint:
    "Minimum 2 (max 100 000). Sztuki 1:1 — przycisk „Usuń (sztuki 1:1)”, nie zapisuj „1”.",
  packagingLabelField: "Etykieta",
  packagingClearCta: "Usuń (sztuki 1:1)",
  packagingNeedLabel: "Potrzeba",
  packagingOrderLabel: "Na ZD",
  packagingOverrideHint:
    "Wpisujesz jednostki na dokumencie ZD (opakowania), nie sztuki.",
  packagingOverrideHintPieces:
    "Wpisujesz sztuki na dokumencie ZD (dobite do paczki).",
  packagingUnitsMinError:
    "Opakowanie wymaga co najmniej 2 sztuk na 1 jednostkę ZD. Sztuki 1:1 — usuń ustawienie.",
  packagingUnitsMaxError:
    "Liczba sztuk w opakowaniu jest zbyt duża (max 100 000).",
  packagingBulkUnitsHint:
    "Minimum 2 (max 100 000) dla wszystkich zaznaczonych. Sztuki 1:1 — osobna akcja „Usuń opakowanie”, nie zapisuj „1”.",
  packagingBulkPreviewPackages:
    "Niedobór liczymy w sztukach, a „Do ZD” pokaże liczbę opakowań (zaokrąglenie w górę).",
  packagingBulkPreviewPieces:
    "Niedobór liczymy w sztukach, a „Do ZD” pokaże sztuki dobite do wielokrotności N (nie liczbę paczek).",
  packagingBulkClearHint:
    "Zaznaczone wrócą do zamawiania na sztuki 1:1 w kolumnie Do ZD (bez paczki i bez dobicia).",
  packagingPairConflictTitle: "Konflikt opakowanie ↔ para",
  packagingPairConflictUnitsBody:
    "opakowanie inne niż para — tworzenie ZD zablokowane do ujednolicenia.",
  packagingPairConflictModeBody:
    "tryb „dobicie w sztukach” na paczce z pary — tworzenie ZD zablokowane do ujednolicenia.",
  packagingPairConflictMixedBody:
    "rozjazd opakowania / trybu względem pary — tworzenie ZD zablokowane do ujednolicenia.",
  packagingLabelPresetsAria: "Szybki wybór etykiety opakowania",
} as const;

/** Hint po timeout create, gdy async znalazł świeże ZD. */
export function formatPostCreateCandidatesHint(n: number): string | null {
  const count = Math.max(0, Math.round(Number(n) || 0));
  if (count <= 0) return null;
  if (count === 1) {
    return "Znaleziono 1 świeże ZD u kontrahenta — możesz powiązać historię.";
  }
  return `Znaleziono ${count} świeżych ZD u kontrahenta — wybierz właściwy przy powiązaniu.`;
}

/** Preflight przed Create / Powiąż ZD — pozycje bez jawnego opakowania / pary. */
export type ImplicitPieceSnapshotNotice = {
  count: number;
  countLabel: string;
  title: string;
  body: string;
  samples: ReadonlyArray<{ symbol: string; twId: number; label: string }>;
  moreCount: number;
  /** Jedna linia — dialogi / aria / legacy. */
  summaryLine: string;
};

export function buildImplicitPieceSnapshotNotice(
  lines: ReadonlyArray<{ symbol: string; twId: number }>,
  maxNames = 6
): ImplicitPieceSnapshotNotice | null {
  if (!lines.length) return null;
  const n = lines.length;
  const countLabel = `${n} ${zdEstimatePlCountWord(n, "pozycja", "pozycje", "pozycji")}`;
  const samples = lines.slice(0, maxNames).map((l) => ({
    symbol: l.symbol,
    twId: l.twId,
    label: `${l.symbol} (${l.twId})`,
  }));
  const moreCount = Math.max(0, n - samples.length);
  const sampleText = samples.map((s) => s.label).join(", ");
  const more = moreCount > 0 ? ` (+${moreCount})` : "";
  const summaryLine = `${countLabel} bez opakowania ani pary (${sampleText}${more}) — historia zapisze jednostki ZD jako sztuki 1:1. Ustaw opakowanie (≥2 szt/op.) lub parę, jeśli towar idzie w paczkach.`;
  return {
    count: n,
    countLabel,
    title: ZD_ESTIMATE_UI.implicitPieceSnapshotTitle,
    body: ZD_ESTIMATE_UI.implicitPieceSnapshotBody,
    samples,
    moreCount,
    summaryLine,
  };
}

/** @deprecated Preferuj `buildImplicitPieceSnapshotNotice` + komponent UI. */
export function formatImplicitPieceSnapshotHint(
  lines: ReadonlyArray<{ symbol: string; twId: number }>,
  maxNames = 4
): string | null {
  return buildImplicitPieceSnapshotNotice(lines, maxNames)?.summaryLine ?? null;
}

// ============================================================================
// Zewnętrzna sesja kreatora ZD (po „Policz” i wyjściu na inne stronę)
// ============================================================================

export const zdEstimateExternalSessionFloatingTitle = "Sesja Kreatora ZD";

export function zdEstimateExternalSessionFloatingCountdown(input: {
  remainingMs: number;
}): string {
  return `Wygasa za ${formatZdEstimateElapsedCompact(input.remainingMs)}`;
}

export const zdEstimateExternalSessionFloatingHint =
  "Po powrocie wczytamy listę i Twoje zmiany — bez ponownego liczenia.";

export const zdEstimateExternalSessionFloatingCompactLabel = "Sesja";

export const zdEstimateExternalSessionReturnCtaLabel = "Wróć do kreatora";

export const zdEstimateExternalSessionCloseCtaLabel = "Zamknij sesję";

export const zdEstimateExternalSessionCancelButtonLabel =
  "Anuluj sesję kreatora";

export const zdEstimateExternalSessionActiveStatusTitle = "Sesja aktywna";

export const zdEstimateExternalSessionActiveStatusBody =
  "Na tym ekranie nie wygasa. Po wyjściu z kreatora masz 3 min na powrót.";

export function zdEstimateExternalSessionRestoredToastDescription(input: {
  updatedAt: string | null;
}): string {
  const when = input.updatedAt ? formatWarsawDateTime(input.updatedAt) : null;
  return when
    ? `Przywrócono listę i zmiany z ${when}. To nie było ponowne liczenie — możesz od razu kontynuować.`
    : "Przywrócono zapisaną listę i zmiany. To nie było ponowne liczenie — możesz od razu kontynuować.";
}

export const zdEstimateExternalSessionRestoredToastTitle =
  "Sesja wznowiona";

export const zdEstimateExternalSessionExpiredAlertTitle =
  "Poprzednia sesja wygasła";

export const zdEstimateExternalSessionExpiredAlertBody =
  "Nie można wznowić poprzedniego wyniku. Policz listę od nowa, aby kontynuować.";

export const zdEstimateExternalSessionRestoreFailedAlertTitle =
  "Nie udało się przywrócić poprzedniej sesji";

export const zdEstimateExternalSessionRestoreFailedAlertBody =
  "Poprzedniej sesji nie udało się przywrócić — policz ponownie.";

export const zdEstimateExternalSessionPersistFailedAlertTitle =
  "Lista jest gotowa, ale nie zapisaliśmy sesji wznowienia";

export const zdEstimateExternalSessionPersistFailedAlertBody =
  "Jeśli opuścisz kreator, nie wrócisz do tego wyniku po nawigacji.";

export const zdEstimateExternalSessionAutorunConflictTitle =
  "Masz aktywną sesję kreatora";

export const zdEstimateExternalSessionAutorunConflictMessage =
  "Możesz wznowić poprzednią sesję albo odrzucić ją i policzyć listę od nowa.";

export const zdEstimateExternalSessionAutorunResumeLabel =
  "Wznów poprzednią sesję";

export const zdEstimateExternalSessionAutorunDiscardLabel =
  "Odrzuć sesję i policz od nowa";

export const zdEstimateExternalSessionScopeChangeTitle =
  "Zamknąć obecną sesję?";

export const zdEstimateExternalSessionScopeChangeMessage =
  "Zmiana dostawcy, grupy, cechy lub okna sprzedaży zakończy obecną sesję i usunie jej wynik.";

export const zdEstimateExternalSessionScopeChangeConfirmLabel =
  "Kontynuuj i zamknij sesję";

export const zdEstimateExternalSessionScopeChangeCancelLabel =
  "Zostań przy obecnej sesji";

export const zdEstimateExternalSessionCancelConfirmTitle =
  "Anulować sesję kreatora ZD?";

export const zdEstimateExternalSessionCancelConfirmMessage =
  "Zamkniesz bieżącą sesję kreatora. Nie będziesz mógł wrócić do przywróconego snapshotu po nawigacji.";

export const zdEstimateExternalSessionCancelConfirmLabel = "Anuluj sesję";
export const zdEstimateExternalSessionCancelDialogCancelLabel = "Zostań";
