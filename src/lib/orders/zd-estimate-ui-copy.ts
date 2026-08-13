/**
 * Teksty UI kreatora ZD — polszczyzna dla zakupów, bez żargonu API/SQL.
 */

/** Krótki flow w intro — ten sam na loadingu i stronie (bez skoku copy). */
export const ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION =
  "Zakres Subiekta → lista do zamówienia → Utwórz ZD.";

export function zdEstimateRouteLoadingAriaLabel(): string {
  return "Wczytuję kreator ZD";
}

export function zdEstimateRouteLoadingTitle(): string {
  return "Wczytuję kreator ZD";
}

export function zdEstimateRouteLoadingSubtitle(): string {
  return "Ładuję ustawienia działu i połączenie z Subiektem…";
}

export function zdEstimateRouteLoadingFooter(): string {
  return "To nie jest jeszcze liczenie listy — zaraz wybierzesz zakres i klikniesz „Policz listę”.";
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
    ? "Wybierz szybki chip (Falcon, Ivoclar…) albo wyszukaj grupę — zapas i daty ustawią się same. Potem „Policz listę”."
    : "Wyszukaj i wybierz cechę — zapas i daty ustawią się z nazwy, jeśli jest karta dostawcy. Potem „Policz listę”.";
}

export function zdEstimateReadyToCountHint(): string {
  return "Gotowe do policzenia — kliknij „Policz listę”.";
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
    ? "Liczy listę do ZD…"
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
  createGateExplodeBomIncomplete:
    "Skład „Składamy” jest niekompletny (brak towarów w wyniku) — dociągnij węzły (Policz) zanim utworzysz ZD.",
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
  implicitPieceSnapshotTitle:
    "Historia zapisze część pozycji jako sztuki 1:1 (brak opakowania / pary)",
  emptyOrderTitle: "Brak pozycji do ZD",
  emptyExcludedTitle: "Brak wykluczeń w tym zakresie",
  emptyExcludedDescription:
    "Żaden produkt nie jest wykluczony ręcznie, automatycznie (outlet / wycofane / zęby) ani „tylko na prośbę” bez aktywnej prośby.",
  excludedFilterTitle:
    "Hard + auto + tylko na prośbę bez aktywnej prośby. Z prośbą — w Do ZD (qty = prośba).",
  advancedZapasMinLabel: "Bufor minimum (szt.)",
  advancedZapasMinHint: "Dodatkowy zapas minimum doliczany do celu.",
  boostPowerLabel: "Moc boosta sprzedaży",
  boostPowerDefaultHint:
    "Domyślnie Delikatny — bezpieczniejsze niż dotychczasowy Standard; możesz przełączyć.",
  boostPowerOffHint:
    "Wyłączony = bez podbijania; cięcia przy grubym cover nadal działają.",
  boostNeedsRecountTitle: "Moc boosta zmieniona",
  boostNeedsRecountBody:
    "Lista Do ZD pochodzi z poprzedniej mocy. Przelicz, zanim utworzysz ZD.",
  boostNeedsRecountCta: "Przelicz z nową mocą",
  createGateBoostNeedsRecount:
    "Moc boosta zmieniona — przelicz listę przed Create.",
  supplierScopesPanelTitle: "Zakresy dostawców",
  supplierScopesPanelHint:
    "Globalne mapowanie dostawca ↔ grupa/cecha Subiekta (wspólne dla wszystkich).",
  supplierScopesAddCta: "Dodaj mapowanie",
  supplierScopesAddHint:
    "Wybierz dostawcę bez mapowania, potem grupę lub cechę Subiekta.",
  changeSupplierScopeCta: "Zmień przypisanie",
  changeSupplierScopeTitle: "Zmień zakres Subiekta",
  changeSupplierScopeHint:
    "Wybierz inną grupę lub cechę poniżej, potem „Zapisz zakres i policz”.",
  changeSupplierScopeCancelCta: "Anuluj zmianę",
  assignSupplierScopeTitle: "Przypisz zakres Subiekta",
  onRequestVsHardExclude:
    "„Tylko na prośbę” — poza Do ZD bez prośby; z prośbą qty = tylko prośba. Twarde wykluczenie — prośba trafia do usług/uwag.",
  postCreateTitleCreated: "ZD utworzone",
  postCreateTitleLinked: "ZD powiązane",
  postCreateTitleTimeout: "Sprawdź wynik create",
  postCreateDokUnconfirmed: "niepotwierdzony",
  postCreateStatusSubiektOk: "Dokument w Subiekcie",
  postCreateStatusSubiektUnsure: "Dokument w Subiekcie — niepewny (timeout)",
  postCreateStatusHistoryOk: "Historia zapisana",
  postCreateStatusHistoryNeed: "Historia wymaga powiązania",
  postCreateStatusGlowneNone: "Prośby Główne — bez zmian",
  postCreateMailCta: "Napisz do dostawcy",
  postCreateMailDisabled: "Brak adresu e-mail na karcie dostawcy",
  postCreateDzisCta: "Otwórz w Dziś",
  postCreateLinkHistoryCta: "Powiąż historię",
  postCreateLinkTimeoutCta: "Sprawdź świeże ZD",
  postCreateCopyTsvCta: "Skopiuj TSV",
  postCreateDismissCta: "Zamknij podsumowanie",
  postCreateDismissHint:
    "Zamyka tylko to podsumowanie — Create pozostaje zablokowany do odblokowania lub Policz.",
  postCreateNoContact: "Brak kontaktu na karcie dostawcy",
  postCreateCardsLink: "Uzupełnij kontakt",
  postCreateDzisMissingSupplier:
    "Brak tego dostawcy na liście Dziś — otwórz panel ręcznie.",
  postCreateLinkRecoveryHint:
    "Dokończ historię po create — wybierz dokument ZD i zapisz snapshot.",
  postCreateTimeoutLockLabel: "niepotwierdzony (timeout)",
  postCreateTimeoutLockBody:
    "Ostatnie tworzenie ZD mogło się udać w Subiekcie mimo timeoutu. Sprawdź dokument, powiąż historię, przelicz listę albo odblokuj świadomie — unikaj duplikatu.",
  postCreateUnlockCta: "Odblokuj Create",
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
    "opakowanie inne niż para — Create zablokowany do ujednolicenia.",
  packagingPairConflictModeBody:
    "tryb „dobicie w sztukach” na paczce z pary — Create zablokowany do ujednolicenia.",
  packagingPairConflictMixedBody:
    "rozjazd opakowania / trybu względem pary — Create zablokowany do ujednolicenia.",
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
  const countLabel =
    lines.length === 1 ? "1 pozycja" : `${lines.length} pozycje`;
  return `${countLabel} bez opakowania ani pary (${sample}${more}) — historia zapisze jednostki ZD jako sztuki 1:1. Ustaw opakowanie (≥2 szt/op.) lub parę, jeśli towar idzie w paczkach.`;
}
