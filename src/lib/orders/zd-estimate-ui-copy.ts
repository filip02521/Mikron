/**
 * Teksty UI kreatora ZD — polszczyzna dla zakupów, bez żargonu API/SQL.
 */

/** Krótki flow w intro — ten sam na loadingu i stronie (bez skoku copy). */
export const ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION =
  "Zakres Subiekta → lista do zamówienia → Utwórz ZD.";

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
  return "Zostajesz na tym ekranie do końca liczenia.";
}

export function zdEstimateLaunchProgressCompleteTitle(): string {
  return "Lista gotowa";
}

export function zdEstimateLaunchProgressCompleteHint(): string {
  return "Pokazuję wynik…";
}

export function zdEstimateCreateProgressCompleteTitle(): string {
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

export function zdEstimateScopeDashedHint(mode: "grupa" | "cecha"): string {
  return mode === "grupa"
    ? "Wybierz szybki skrót (Falcon, Ivoclar…) albo wyszukaj grupę — zapas i daty ustawią się same. Potem „Policz listę”."
    : "Wyszukaj i wybierz cechę — zapas i daty ustawią się z nazwy, jeśli jest karta dostawcy. Potem „Policz listę”.";
}

export function zdEstimateReadyToCountHint(): string {
  return "Gotowe — kliknij „Policz listę”.";
}

export function zdEstimateScopeChangedHint(): string {
  return "Zakres zmieniony — policz ponownie, żeby odświeżyć listę.";
}

export function zdEstimateNeedsSettingsHint(): string {
  return "Najpierw wczytaj ustawienia działu (baner powyżej), potem „Policz listę”.";
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
  return "Przeliczam listę…";
}

export function zdEstimateRecountOverlayHint(isLive: boolean): string {
  return isLive
    ? "Pobieram dane z aktualnej bazy Subiekta — lista zostaje na ekranie."
    : "Pobieram dane z testowego Subiekta — lista zostaje na ekranie.";
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
  return "Liczę…";
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
    return "Skonfiguruj połączenie z Subiektem (host kreatora), żeby policzyć listę i utworzyć ZD.";
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
  return "Kreator ZD jest zablokowany (brak połączenia z Subiektem). CTA z panelu dziennego nie uruchomi listy — ustaw host kreatora w konfiguracji i odśwież stronę.";
}

export function zdEstimateBlockedOrdersAlertBody(message: string | null): string {
  return (
    message?.trim() ||
    "Brak połączenia z hostem kreatora ZD Subiekta (live lub test). Skontaktuj się z administratorem albo sprawdź konfigurację środowiska."
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
    return `Dokument powstanie w aktualnej bazie Subiekta (:${input.port}). Nie da się cofnąć z OnTime. Po sukcesie w podsumowaniu zdecydujesz, czy odznaczyć prośby jako Główne i czy oznaczyć plan jako złożony.`;
  }
  return `Dokument powstanie w testowym Subiekcie (:${input.port}). Nie da się cofnąć z OnTime. Termin realizacji ustawisz w Subiekcie. Po sukcesie w podsumowaniu zdecydujesz, czy odznaczyć prośby i plan.`;
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
      ? " — po utworzeniu w podsumowaniu zdecydujesz, czy odznaczyć prośby i plan"
      : "";
  return `${base}${follow}.`;
}

/** Legenda jednostek nad tabelą wyniku. */
export const ZD_ESTIMATE_UNITS_LEGEND =
  "Jednostki: Sprzed. / Cel / Dost. = sztuki (przy paczce lub opakowaniu pod spodem ≈ op.). Do ZD = jednostki dokumentu (op. przy opakowaniu). Otwarte ZD = jednostki dokumentu (przy opakowaniu poniżej także w sztukach).";

export const ZD_ESTIMATE_UI = {
  policzNeedsSettingsTitle:
    "Wymaga wczytanych wykluczeń, „tylko na prośbę”, opakowań, par, składów i katalogu zębów",
  createGateNeedsSettings:
    "Najpierw wczytaj wykluczenia, listę „tylko na prośbę”, opakowania, pary, składy i katalog zębów.",
  createGateExplodeBomIncomplete:
    "Skład w trybie „Składamy” jest niekompletny (brak towarów w wyniku) — dociągnij brakujące pozycje („Policz listę”), zanim utworzysz ZD.",
  createProgressDisclaimer:
    "Postęp jest szacunkowy (Subiekt nie pokazuje kroków na bieżąco) — lista może dłużej zostać na „Tworzenie w Subiekcie”.",
  createQtyBumpNote:
    "Po utworzeniu serwer może podbić ilość na pozycjach, żeby pokryć rezerwę próśb handlowców (zaokrąglenie opakowania w górę).",
  createTeethNote:
    "Prośby zębów trafiają do uwag dokumentu i nie są odznaczane jako Główne z tego ekranu.",
  createAfterSuccessDecide:
    "Po utworzeniu ZD w podsumowaniu zdecydujesz, czy odznaczyć prośby jako Główne i czy oznaczyć planowane zamówienie jako złożone.",
  pairCoverLabel: "pokrycie",
  packagingConflictShort: "Konflikt opakowania",
  packagingConflictTitle:
    "Opakowanie w OnTime różni się od przelicznika pary — sprawdź ustawienia przed utworzeniem ZD.",
  implicitPieceSnapshotTitle:
    "Historia zapisze część pozycji jako sztuki 1:1 (brak opakowania / pary)",
  emptyOrderTitle: "Brak pozycji do ZD",
  emptyExcludedTitle: "Brak wykluczeń w tym zakresie",
  emptyExcludedDescription:
    "Żaden produkt nie jest wykluczony ręcznie, automatycznie (outlet / wycofane / zęby) ani „tylko na prośbę” bez aktywnej prośby.",
  excludedFilterTitle:
    "Wykluczenia ręczne, automatyczne oraz „tylko na prośbę” bez aktywnej prośby. Z prośbą — w Do ZD (ilość = prośba).",
  advancedZapasMinLabel: "Bufor minimum (szt.)",
  advancedZapasMinHint: "Dodatkowy zapas minimum doliczany do celu.",
  boostPowerLabel: "Podbicie sprzedaży",
  boostPowerDefaultHint:
    "Domyślnie Delikatny — ostrożniejsze podbicie Do ZD; możesz przełączyć na mocniejsze albo wyłączyć.",
  boostPowerOffHint:
    "Wyłączony = bez podbijania z tempa sprzedaży. Cięcia przy grubym pokryciu magazynowym nadal działają.",
  boostNeedsRecountTitle: "Zmieniono podbicie sprzedaży",
  boostNeedsRecountBody:
    "Lista Do ZD pochodzi z poprzedniego ustawienia. Przelicz, zanim utworzysz ZD.",
  boostNeedsRecountCta: "Przelicz z nowym podbiciem",
  createGateBoostNeedsRecount:
    "Zmieniono podbicie sprzedaży — przelicz listę przed utworzeniem ZD.",
  historyNeedsRecountTitle: "Zmieniono historię powiązań ZD",
  historyNeedsRecountBody:
    "Włączono lub wyłączono snapshot w historii zamówień. Przelicz listę przed utworzeniem ZD — korekta z historii mogła się zmienić.",
  historyNeedsRecountCta: "Przelicz z historią",
  createGateHistoryNeedsRecount:
    "Zmieniono historię powiązań ZD — przelicz listę przed utworzeniem ZD.",
  supplierScopesPanelTitle: "Zakresy dostawców",
  supplierScopesPanelHint:
    "Globalne mapowanie dostawca ↔ grupa lub cecha Subiekta — wspólne dla całego działu zakupów. Używane przy wejściu z kolejki Dziś i przy skrótach w kreatorze.",
  supplierScopesIntroTitle: "Jedno mapowanie na dostawcę",
  supplierScopesIntroBody:
    "Dostawca z kolejki Dziś otwiera kreator z przypisaną grupą lub cechą. Zmiana tutaj obowiązuje wszystkich w dziale.",
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
    "Dodaj mapowanie albo zapisz zakres przy pierwszym wejściu z Dziś.",
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
    "Dostawcy: mapowania zakresów Subiekta i historia powiązań ZD",
  departmentSettingsMenuTrigger: "Reguły listy",
  departmentSettingsMenuTriggerCompact: "Reguły",
  departmentSettingsMenuAriaLabel:
    "Reguły listy Do ZD: wykluczenia, prośby, opakowania, pary, składy",
  todayScopeCoverageTitle: "Dziś bez mapowania",
  todayScopeCoverageEmpty: "Wszyscy dostawcy z kolejki Dziś mają zakres.",
  todayScopeCoverageHint:
    "Przypisz zakres, żeby wejście z Dziś od razu otwierało właściwą grupę lub cechę.",
  snapshotsModalTitle: "Historia powiązań ZD",
  snapshotsModalHint:
    "Zapisane powiązania ZD korygują kolejne szacunki. Ilości są w sztukach. Wyłącz błędne powiązanie, żeby nie zaniżało następnych list.",
  snapshotsModalSelectHint:
    "Wybierz powiązanie z listy, żeby zobaczyć linie i zarządzać udziałem w historii.",
  snapshotsModalEmptyTitle: "Brak powiązań",
  snapshotsModalEmptyDescription:
    "Po utworzeniu lub powiązaniu ZD historia pojawi się tutaj.",
  snapshotsModalLinesEmpty: "Brak linii w tym powiązaniu.",
  snapshotsModalLinesCaption:
    "Ilości w sztukach — tak uczy się korekta z historii przy kolejnym „Policz listę”.",
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
  extrasPolicyLabel: "Prośby a niedobór magazynowy",
  extrasPolicySumLabel: "Suma (niedobór + prośba)",
  extrasPolicyMaxLabel: "Maksimum (większa z niedoboru i prośby)",
  extrasPolicySumHint:
    "Rezerwa próśb dokłada się do niedoboru — typowe przy Ivoclar/Falcon.",
  extrasPolicyMaxHint:
    "Gdy prośba już pokrywa niedobór, nie dubluj sztuk.",
  reviewAcceptCta: "Zaakceptuj",
  reviewZeroCta: "Zeruj Do ZD",
  reviewAcceptHint: "Zdejmuje flagę „Do weryfikacji” w tej sesji.",
  reviewZeroHint: "Ustawia Do ZD = 0 na zaznaczonych pozycjach.",
  changeSupplierScopeCta: "Zmień przypisanie",
  changeSupplierScopeTitle: "Zmień zakres Subiekta",
  changeSupplierScopeHint:
    "Wybierz inną grupę lub cechę poniżej, potem „Zapisz zakres i policz”.",
  changeSupplierScopeCancelCta: "Anuluj zmianę",
  assignSupplierScopeTitle: "Przypisz zakres Subiekta",
  onRequestVsHardExclude:
    "„Tylko na prośbę” — poza Do ZD bez prośby; z prośbą ilość = tylko prośba. Twarde wykluczenie — prośba trafia do usług/uwag.",
  postCreateTitleCreated: "ZD utworzone",
  postCreateTitleLinked: "ZD powiązane",
  postCreateTitleTimeout: "Sprawdź wynik tworzenia",
  postCreateDokUnconfirmed: "niepotwierdzony",
  postCreateStatusSubiektOk: "Dokument w Subiekcie",
  postCreateStatusSubiektUnsure: "Dokument w Subiekcie — niepewny (timeout)",
  postCreateStatusHistoryOk: "Historia zapisana",
  postCreateStatusHistoryNeed: "Historia wymaga powiązania",
  postCreateStatusGlowneNone: "Prośby Główne — jeszcze nie odznaczono",
  postCreateStatusGlownePending: "Prośby Główne — czekają na Twoją decyzję",
  postCreateStatusGlowneDone: "Prośby odznaczone jako Główne",
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
  postCreatePreviewScrollHint: "pozycji — przewiń, żeby zobaczyć wszystkie",
  postCreateSearchPlaceholder: "Filtruj symbol, PLU, nazwę…",
  postCreateMailCta: "Napisz do dostawcy",
  postCreateMailDisabled: "Brak adresu e-mail na karcie dostawcy",
  postCreateDzisCta: "Otwórz w Dziś",
  postCreateLinkHistoryCta: "Powiąż historię",
  postCreateLinkTimeoutCta: "Sprawdź świeże ZD",
  postCreateCopyTsvCta: "Skopiuj TSV",
  postCreateDismissCta: "Zamknij podsumowanie",
  postCreateDismissHint:
    "Zamyka tylko to podsumowanie — tworzenie ZD pozostaje zablokowane do odblokowania albo do „Policz listę”.",
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
    "Wybierz tryb: jednostki na ZD = paczki, albo Do ZD w sztukach z dobiciem do wielokrotności N.",
  packagingModePackagesLabel: "1 na ZD = N szt (paczki na dokumencie)",
  packagingModePiecesLabel: "Do ZD w sztukach — dobij do wielokrotności N",
  packagingModePackagesHint:
    "Na dokumencie wpisujesz liczbę opakowań (np. 2 przy potrzebie 8 i N=5).",
  packagingModePiecesHint:
    "Na dokumencie wpisujesz sztuki — system dobija do pełnych paczek (np. 10 przy potrzebie 8 i N=5).",
  packagingModePairBlockedHint:
    "Na paczce z pary montaż/demontaż dostępny jest tylko tryb opakowań (1 na ZD = N szt).",
  packagingModeBulkPairBlockedHint:
    "Zaznaczenie zawiera paczkę z pary — tryb „dobicie w sztukach” jest niedostępny (tylko opakowania).",
  packagingLiveFlash:
    "Opakowania zaktualizowane — pokrycie i Do ZD przeliczone.",
  packagingModalTitle: "Opakowania ZD",
  packagingModalHint:
    "Tryb A: 1 na ZD = opakowanie. Tryb B: Do ZD w sztukach, dobij do N. Sztuki 1:1 — „Usuń”.",
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
export function formatImplicitPieceSnapshotHint(
  lines: ReadonlyArray<{ symbol: string; twId: number }>,
  maxNames = 4
): string | null {
  if (!lines.length) return null;
  const sample = lines
    .slice(0, maxNames)
    .map((l) => `${l.symbol} (${l.twId})`)
    .join(", ");
  const more =
    lines.length > maxNames ? ` (+${lines.length - maxNames})` : "";
  const n = lines.length;
  const mod10 = n % 10;
  const mod100 = n % 100;
  const countLabel =
    n === 1
      ? "1 pozycja"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? `${n} pozycje`
        : `${n} pozycji`;
  return `${countLabel} bez opakowania ani pary (${sample}${more}) — historia zapisze jednostki ZD jako sztuki 1:1. Ustaw opakowanie (≥2 szt/op.) lub parę, jeśli towar idzie w paczkach.`;
}
