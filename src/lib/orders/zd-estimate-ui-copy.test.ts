import { describe, expect, it } from "vitest";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  ZD_ESTIMATE_UI,
  buildImplicitPieceSnapshotNotice,
  formatImplicitPieceSnapshotHint,
  zdEstimateCreateConfirmLabel,
  zdEstimateCreateTitleHint,
  zdEstimateCechaScopeCaption,
  zdEstimateEmptyListDescription,
  zdEstimateHostBadgeLabel,
  zdEstimateLaunchFetchHint,
  zdEstimateLaunchProgressTitle,
  zdEstimateLaunchProgressCompleteTitle,
  zdEstimateLaunchProgressCompleteHint,
  zdEstimateCreateProgressCompleteTitle,
  zdEstimateCreateProgressCompleteHint,
  zdEstimateCreateProgressFooterBusy,
  zdEstimateCreateProgressFooterLong,
  zdEstimateCreateProgressFooterNote,
  zdEstimateCreateProgressWindowHint,
  zdEstimateLaunchProgressSteps,
  zdEstimateLoadingBusyDetailProgress,
  zdEstimateLoadingBusyDetailRoute,
  zdEstimateNeedsSettingsHint,
  zdEstimatePageContextFromSupplier,
  zdEstimatePageFlowSteps,
  zdEstimatePageHint,
  zdEstimatePageLead,
  zdEstimatePoliciesSectionHint,
  zdEstimatePrepCardHint,
  zdEstimatePrepIdleLead,
  zdEstimateProsbaWord,
  zdEstimateProsbaWordAccusative,
  zdEstimateLaunchReadyToastDescription,
  zdEstimateLaunchReadyToastTitle,
  zdEstimateReadyToCountHint,
  zdEstimateRecountOverlayHint,
  zdEstimateRecountOverlayMessage,
  zdEstimateRouteLoadingSteps,
  zdEstimateRouteLoadingSubtitle,
  zdEstimateRouteLoadingHint,
  zdEstimateScopeChangedHint,
  zdEstimateScopeDashedHint,
  zdEstimateScopeKindLabel,
  zdEstimateScopeLinkedCaption,
  zdEstimateScopeLinkedTitle,
  zdEstimateSnapshotsFooterCount,
  zdEstimateSnapshotsLinesCount,
  zdEstimateSupplierScopesFooterCount,
  zdEstimateSuppliersMenuAriaLabel,
  zdEstimateSuppliersScopesItemSuffix,
  zdEstimateSuppliersUnmappedBadge,
} from "./zd-estimate-ui-copy";

describe("zd-estimate-ui-copy", () => {
  it("badge LIVE vs test", () => {
    expect(zdEstimateHostBadgeLabel({ isLive: true, port: 5080 })).toBe(
      "LIVE :5080"
    );
    expect(zdEstimateHostBadgeLabel({ isLive: false, port: 5082 })).toBe(
      "Test :5082"
    );
  });

  it("page hint bez host_kind i bez etykiety LIVE (status jest w intro)", () => {
    expect(zdEstimatePageHint({ isLive: true, configured: true })).not.toMatch(
      /host_kind/
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).not.toMatch(
      /\bLIVE\b/
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).toMatch(
      /Do ZD/i
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).toMatch(
      /prawdziwy dokument/i
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).toMatch(
      /tylko na prośbę/i
    );
  });

  it("empty / launch bez „testowego” na live", () => {
    expect(zdEstimateEmptyListDescription(true)).not.toMatch(/testowego/);
    expect(zdEstimateLaunchFetchHint(true)).toMatch(/aktualnej bazy/);
    expect(zdEstimateLaunchFetchHint(false)).toMatch(/testowego/);
  });

  it("confirm live nie obiecuje automatycznego Główne", () => {
    const text = zdEstimateCreateConfirmLabel({
      isLive: true,
      port: 5080,
      markCount: 2,
    });
    expect(text).toMatch(/aktualnej bazie/);
    expect(text).toMatch(/zdecydujesz/i);
    expect(text).toMatch(/panelu na tej stronie/);
    expect(text).not.toMatch(/\/podsumowanie/);
    expect(text).not.toMatch(/zostaną odznaczone jako Główne/);
  });

  it("title hint rozróżnia panel kreatora od trasy /podsumowanie", () => {
    const hint = zdEstimateCreateTitleHint({ isLive: true, port: 5080 });
    expect(hint).toMatch(/panelu po utworzeniu na tej stronie/);
    expect(hint).not.toMatch(/w podsumowaniu zdecydujesz/);
  });

  it("dismiss post-create mówi o panelu, nie o podsumowaniu", () => {
    expect(ZD_ESTIMATE_UI.postCreateDismissCta).toMatch(/panel/i);
    expect(ZD_ESTIMATE_UI.postCreateDismissHint).toMatch(/ten panel/);
    expect(ZD_ESTIMATE_UI.postCreateDismissHint).not.toMatch(/podsumowanie/);
    expect(ZD_ESTIMATE_UI.createAfterSuccessDecideNoGlowne).toMatch(
      /panelu na tej stronie/
    );
    expect(ZD_ESTIMATE_UI.postCreateStatusGlowneClearedSkipped).toMatch(
      /pominięto/i
    );
    expect(ZD_ESTIMATE_UI.createOmittedServicesHint).not.toMatch(/Skróć bazę/);
    expect(ZD_ESTIMATE_UI.listShowZkColumnTitle).not.toMatch(/\bAPI\b/);
    expect(ZD_ESTIMATE_UI.createGatePendingIndividualsError).toMatch(
      /próśb handlowców/
    );
    expect(ZD_ESTIMATE_UI.createGateHistoryFetchFailed).toMatch(/historii/);
    expect(ZD_ESTIMATE_UI.createGatePendingIndividualsTruncated).toMatch(/500/);
  });

  it("sort Symbol / Nazwa — osobne hinty, Status bez sortu po nazwie", () => {
    expect(ZD_ESTIMATE_UI.listSortSymbolHint).toMatch(/symbol/i);
    expect(ZD_ESTIMATE_UI.listSortNameHint).toMatch(/nazw/i);
    expect(ZD_ESTIMATE_UI.listStatusColumnHint).toMatch(/chip/i);
    expect(ZD_ESTIMATE_UI.listStatusColumnHint).toMatch(/do 4|\+N/i);
    expect(ZD_ESTIMATE_UI.listStatusColumnHint).not.toMatch(/Nazwa/);
  });

  it("belka listy — skrócone filtry i zaznaczenie w menu", () => {
    expect(ZD_ESTIMATE_UI.listFilterReviewShort).toBe("Weryfikacja");
    expect(ZD_ESTIMATE_UI.listFilterExcludedShort).toBe("Wykluczone");
    expect(ZD_ESTIMATE_UI.listSelectVisible(27)).toMatch(/widoczne \(27\)/);
    expect(ZD_ESTIMATE_UI.listMoreMenuLabel).toMatch(/Ustawienia listy/i);
  });

  it("route loading bez „dla dostawcy” i ze stałym flow description", () => {
    expect(ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION).toMatch(/Zakres Subiekta/);
    expect(zdEstimatePageLead()).toMatch(/zakres/i);
    expect(zdEstimatePageLead()).toMatch(/utwórz/i);
    expect(zdEstimatePageFlowSteps()).toHaveLength(3);
    expect(zdEstimatePageFlowSteps().map((s) => s.id)).toEqual([
      "scope",
      "list",
      "create",
    ]);
    expect(zdEstimatePageContextFromSupplier("Ivoclar")).toBe(
      "Dostawca: Ivoclar"
    );
    expect(zdEstimatePageContextFromSupplier("  ")).toBeNull();
    expect(zdEstimateRouteLoadingSubtitle()).not.toMatch(/dla dostawcy/i);
    expect(zdEstimateRouteLoadingHint()).toBe(zdEstimateRouteLoadingSubtitle());
    expect(zdEstimateRouteLoadingHint()).not.toMatch(/testowe/i);
    expect(zdEstimateRouteLoadingHint()).not.toMatch(/prawdziwy dokument/i);
    expect(zdEstimateRouteLoadingSteps().length).toBeGreaterThanOrEqual(2);
    for (const step of zdEstimateRouteLoadingSteps()) {
      expect(`${step.title} ${step.activeHint} ${step.doneHint}`).not.toMatch(
        /dla dostawcy/i
      );
      expect(step.title).not.toMatch(/Lista do ZD/i);
    }
  });

  it("launch ready toast — odmiana pozycji i krótki follow-up", () => {
    expect(zdEstimateLaunchReadyToastTitle()).toBe("Lista gotowa");
    expect(
      zdEstimateLaunchReadyToastDescription({
        doZamowieniaCount: 1,
        isLive: true,
      })
    ).toMatch(/^1 pozycja do ZD\./);
    expect(
      zdEstimateLaunchReadyToastDescription({
        doZamowieniaCount: 3,
        pendingIndividualsCount: 2,
        isLive: true,
      })
    ).toMatch(/3 pozycje do ZD · 2 prośby/);
    expect(
      zdEstimateLaunchReadyToastDescription({
        doZamowieniaCount: 5,
        isLive: false,
      })
    ).toMatch(/5 pozycji do ZD/);
    expect(
      zdEstimateLaunchReadyToastDescription({
        doZamowieniaCount: 3,
        isLive: true,
      })
    ).toMatch(/aktualnej bazie/);
    expect(
      zdEstimateLaunchReadyToastDescription({
        doZamowieniaCount: 3,
        isLive: true,
      })
    ).not.toMatch(/Powiąż ZD/);
  });

  it("prep / launch / recount copy", () => {
    expect(zdEstimateScopeDashedHint("grupa")).toMatch(/skrót|wyszukaj grupę/i);
    expect(zdEstimateScopeDashedHint("cecha")).toMatch(/Wyszukaj cechę/);
    expect(zdEstimateScopeDashedHint("grupa")).not.toMatch(/Policz listę/);
    expect(zdEstimateReadyToCountHint()).toMatch(/Policz listę/);
    expect(zdEstimateScopeKindLabel("grupa")).toBe("Grupa");
    expect(zdEstimateScopeKindLabel("cecha")).toBe("Cecha");
    expect(zdEstimateScopeLinkedTitle("grupa")).toMatch(/grupa/i);
    expect(zdEstimateScopeLinkedTitle("cecha")).toMatch(/cecha/i);
    expect(zdEstimateScopeLinkedCaption()).toMatch(/Powiązano/);
    expect(zdEstimateScopeLinkedCaption()).toMatch(/policzyć listę/i);
    expect(zdEstimateScopeChangedHint()).toMatch(/Zmieniono zakres/);
    expect(zdEstimateNeedsSettingsHint()).toMatch(/pod tą kartą/);
    expect(zdEstimateNeedsSettingsHint()).not.toMatch(/powyżej/);
    expect(zdEstimatePrepCardHint()).toMatch(/Policz listę/);
    expect(zdEstimatePrepCardHint()).toMatch(/Reguły/);
    expect(zdEstimatePrepIdleLead()).toMatch(/skrót grupy|wyszukaj/i);
    expect(zdEstimatePrepIdleLead()).not.toMatch(/Policz listę/);
    expect(zdEstimatePoliciesSectionHint()).toMatch(/Do ZD/);
    expect(zdEstimateCechaScopeCaption()).toMatch(/Nadpisania/);
    expect(ZD_ESTIMATE_UI.prepFormTitle).toBe("Przygotowanie");
    expect(ZD_ESTIMATE_UI.prepOverridesShow).toBe("Nadpisania");
    expect(ZD_ESTIMATE_UI.prepParamBoostLabel).toBe("Podbicie");
    expect(ZD_ESTIMATE_UI.prepParamExtrasLabel).toBe("Prośby");
    expect(ZD_ESTIMATE_UI.boostPowerLabel).toBe("Podbicie Do ZD");
    expect(ZD_ESTIMATE_UI.extrasPolicyLabel).toBe("Prośby i niedobór");
    expect(ZD_ESTIMATE_UI.extrasPolicySumShort).toBe("Suma");
    expect(ZD_ESTIMATE_UI.extrasPolicyMaxShort).toBe("Maksimum");
    expect(ZD_ESTIMATE_UI.menuExclusionsDescription).toMatch(/pomijane/);
    expect(ZD_ESTIMATE_UI.menuOnRequestDescription).toMatch(/prośby/);
    expect(ZD_ESTIMATE_UI.menuPackagingDescription).toMatch(/jednostkę/);
    expect(ZD_ESTIMATE_UI.menuPairsDescription).toMatch(/pacz/);
    expect(ZD_ESTIMATE_UI.menuBomsDescription).toMatch(/Zestawy|składniki/);
    expect(ZD_ESTIMATE_UI.menuScopesDescription).toMatch(/Dziś/);
    expect(ZD_ESTIMATE_UI.menuSnapshotsDescription).toMatch(/korygują|histor/);
    expect(ZD_ESTIMATE_UI.exclusionsModalHint).toMatch(/Policz listę/);
    expect(ZD_ESTIMATE_UI.onRequestModalHint).toMatch(/celu zapasu/);
    expect(ZD_ESTIMATE_UI.pairsModalHint).toMatch(/paczki/);
    expect(ZD_ESTIMATE_UI.packagingModalHint).toMatch(/Tryb A/);
    expect(ZD_ESTIMATE_UI.extrasPolicySumHint).toMatch(/niedobór/);
    expect(ZD_ESTIMATE_UI.extrasPolicyMaxHint).toMatch(/większa/);
    expect(ZD_ESTIMATE_UI.changeSupplierScopeHint).toMatch(/formularzu/);
    expect(ZD_ESTIMATE_UI.changeSupplierScopeHint).not.toMatch(/poniżej/);
    expect(ZD_ESTIMATE_UI.changeSupplierScopeCta).toBe("Zmień dostawcę");
    expect(ZD_ESTIMATE_UI.listFilterAllTitleWithCount(42)).toMatch(/42/);
    expect(ZD_ESTIMATE_UI.listFilterAllTitleWithCount(42)).toMatch(/zakres/);
    expect(
      zdEstimateLaunchProgressTitle({ manualWithScope: true })
    ).toMatch(/Liczę listę/);
    expect(
      zdEstimateLaunchProgressTitle({ manualWithScope: false })
    ).toMatch(/Przygotowuję zamówienie/);
    expect(zdEstimateLaunchProgressCompleteTitle()).toBe("Lista gotowa");
    expect(zdEstimateLaunchProgressCompleteHint()).toMatch(/Pokazuję wynik/);
    expect(zdEstimateCreateProgressCompleteTitle()).toBe("ZD gotowe");
    expect(
      zdEstimateCreateProgressCompleteTitle({ snapshotOk: false })
    ).toBe("ZD utworzone");
    expect(
      zdEstimateCreateProgressCompleteHint({ snapshotOk: false })
    ).toMatch(/Powiąż ZD/);
    expect(
      zdEstimateCreateProgressCompleteHint({ snapshotOk: true })
    ).toMatch(/zamykam/);
    expect(zdEstimateCreateProgressFooterBusy()).toMatch(/nie zamykaj/i);
    expect(zdEstimateCreateProgressFooterBusy()).toMatch(/ekranie/);
    expect(zdEstimateCreateProgressFooterLong()).toMatch(/Sfera/i);
    expect(
      zdEstimateCreateProgressFooterNote({
        elapsedMs: 1_000,
        durationHint: "Zwykle poniżej minuty; maksymalnie ok. 3 minuty.",
      })
    ).toMatch(/poniżej minuty/);
    expect(
      zdEstimateCreateProgressFooterNote({
        elapsedMs: 1_000,
        durationHint: "Zwykle poniżej minuty; maksymalnie ok. 3 minuty.",
      })
    ).toMatch(/ekranie/);
    expect(
      zdEstimateCreateProgressFooterNote({
        elapsedMs: 45_000,
        durationHint: "Zwykle poniżej minuty; maksymalnie ok. 3 minuty.",
      })
    ).toMatch(/Sfera/);
    expect(
      zdEstimateCreateProgressWindowHint({
        isLive: true,
      })
    ).toMatch(/szacunkowy/);
    expect(
      zdEstimateCreateProgressWindowHint({
        isLive: false,
        configured: true,
      })
    ).toMatch(/testowym/);
    expect(zdEstimateLoadingBusyDetailProgress()).toMatch(/szacunkowy/);
    expect(zdEstimateLoadingBusyDetailRoute()).toMatch(/ustawień/);
    expect(
      zdEstimateLaunchProgressSteps({
        isLive: true,
        scopeAlreadyResolved: true,
      }).map((s) => s.id)
    ).toEqual(["scope", "fetch", "calc", "list"]);
    expect(zdEstimateRecountOverlayHint(true)).toMatch(/aktualnej bazy/);
    expect(zdEstimateRecountOverlayHint(true)).toMatch(/Utwórz ZD/);
    expect(zdEstimateRecountOverlayHint(false)).toMatch(/testowego/);
    expect(zdEstimateRecountOverlayMessage()).toMatch(/listę Do ZD/);
    expect(ZD_ESTIMATE_UI.createGateEstimating).toMatch(/listy Do ZD/i);
    expect(ZD_ESTIMATE_UI.createGateEstimating).not.toMatch(/szacunku/);
  });

  it("opisy menu i polityk są pełnymi zdaniami po polsku", () => {
    for (const text of [
      ZD_ESTIMATE_UI.menuExclusionsDescription,
      ZD_ESTIMATE_UI.menuOnRequestDescription,
      ZD_ESTIMATE_UI.menuPackagingDescription,
      ZD_ESTIMATE_UI.menuPairsDescription,
      ZD_ESTIMATE_UI.menuBomsDescription,
      ZD_ESTIMATE_UI.menuScopesDescription,
      ZD_ESTIMATE_UI.menuSnapshotsDescription,
      ZD_ESTIMATE_UI.boostNeedsRecountBody,
      ZD_ESTIMATE_UI.historyNeedsRecountBody,
      ZD_ESTIMATE_UI.reviewAcceptHint,
      ZD_ESTIMATE_UI.reviewZeroHint,
      ZD_ESTIMATE_UI.onRequestVsHardExclude,
    ]) {
      expect(text.length).toBeGreaterThan(40);
      expect(text).not.toMatch(/\bAPI\b/);
      expect(text).not.toMatch(/\bsnapshot\b/i);
      expect(text).not.toMatch(/\bboost\b/i);
    }
  });

  it("packagingLiveFlash mówi o pokryciu i Do ZD", () => {
    expect(ZD_ESTIMATE_UI.packagingLiveFlash).toMatch(/pokrycie/i);
    expect(ZD_ESTIMATE_UI.packagingLiveFlash).toMatch(/Do ZD/);
  });

  it("formatImplicitPieceSnapshotHint — null gdy brak linii", () => {
    expect(formatImplicitPieceSnapshotHint([])).toBeNull();
  });

  it("formatImplicitPieceSnapshotHint — sample z tw_Id", () => {
    const hint = formatImplicitPieceSnapshotHint([
      { symbol: "ABC", twId: 1028 },
      { symbol: "DEF", twId: 4914 },
    ]);
    expect(hint).toMatch(/2 pozycje/);
    expect(hint).toMatch(/ABC \(1028\)/);
    expect(hint).toMatch(/sztuki 1:1/);
  });

  it("buildImplicitPieceSnapshotNotice — struktura pod alert UI", () => {
    const notice = buildImplicitPieceSnapshotNotice(
      [
        { symbol: "G2B25", twId: 2382 },
        { symbol: "V130L07", twId: 6484 },
        { symbol: "TP001", twId: 2470 },
      ],
      2
    );
    expect(notice).not.toBeNull();
    expect(notice!.count).toBe(3);
    expect(notice!.countLabel).toBe("3 pozycje");
    expect(notice!.title).toBe(ZD_ESTIMATE_UI.implicitPieceSnapshotTitle);
    expect(notice!.samples).toHaveLength(2);
    expect(notice!.samples[0]).toEqual({
      symbol: "G2B25",
      twId: 2382,
      label: "G2B25 (2382)",
    });
    expect(notice!.moreCount).toBe(1);
    expect(notice!.summaryLine).toMatch(/G2B25 \(2382\)/);
  });

  it("odmiana prośba / prośby / próśb", () => {
    expect(zdEstimateProsbaWord(1)).toBe("prośba");
    expect(zdEstimateProsbaWord(2)).toBe("prośby");
    expect(zdEstimateProsbaWord(4)).toBe("prośby");
    expect(zdEstimateProsbaWord(5)).toBe("próśb");
    expect(zdEstimateProsbaWord(12)).toBe("próśb");
    expect(zdEstimateProsbaWord(22)).toBe("prośby");
    expect(zdEstimateProsbaWordAccusative(1)).toBe("prośbę");
    expect(zdEstimateProsbaWordAccusative(3)).toBe("prośby");
    expect(zdEstimateProsbaWordAccusative(11)).toBe("próśb");
  });

  it("snapshots footer / lines pluralization", () => {
    expect(zdEstimateSnapshotsFooterCount(1)).toBe("1 powiązanie");
    expect(zdEstimateSnapshotsFooterCount(2)).toBe("2 powiązania");
    expect(zdEstimateSnapshotsFooterCount(5)).toBe("5 powiązań");
    expect(zdEstimateSnapshotsLinesCount(1)).toBe("1 linia");
    expect(zdEstimateSnapshotsLinesCount(3)).toBe("3 linie");
    expect(zdEstimateSnapshotsLinesCount(12)).toBe("12 linii");
  });

  it("supplier scopes footer pluralization", () => {
    expect(zdEstimateSupplierScopesFooterCount(1)).toBe("1 mapowanie");
    expect(zdEstimateSupplierScopesFooterCount(2)).toBe("2 mapowania");
    expect(zdEstimateSupplierScopesFooterCount(5)).toBe("5 mapowań");
  });

  it("suppliers menu unmapped badge / aria", () => {
    expect(zdEstimateSuppliersUnmappedBadge(2)).toBe("2 bez mapowania");
    expect(zdEstimateSuppliersUnmappedBadge(2, { compact: true })).toBe(
      "2 bez map."
    );
    expect(zdEstimateSuppliersMenuAriaLabel(0)).toMatch(
      /przypisanie zakresu|historia powiązań/i
    );
    expect(zdEstimateSuppliersMenuAriaLabel(2)).toMatch(/bez mapowania/i);
    expect(zdEstimateSuppliersScopesItemSuffix(0)).toBe("");
    expect(zdEstimateSuppliersScopesItemSuffix(1)).toMatch(/bez mapowania/);
  });

  it("Do ZD hint + sort po pewności (po usunięciu kolumny)", () => {
    expect(ZD_ESTIMATE_UI.listSortByConfidence).toMatch(/pewności/i);
    expect(ZD_ESTIMATE_UI.doZdColumnHint).toMatch(/pewności/i);
    expect(ZD_ESTIMATE_UI.doZdColumnHint).toMatch(/weryfikacji/i);
    expect(ZD_ESTIMATE_UI.doZdColumnHint).toMatch(/nadpisaniu|zaokrągleniu/i);
    expect(ZD_ESTIMATE_UI.selectionGroupReview).toBe("Weryfikacja");
    expect(ZD_ESTIMATE_UI.createPendingReviewWarn(1)).toMatch(
      /1 pozycja nadal ma /
    );
    expect(ZD_ESTIMATE_UI.createPendingReviewWarn(2)).toMatch(
      /2 pozycje nadal mają /
    );
    expect(ZD_ESTIMATE_UI.createPendingReviewWarn(5)).toMatch(
      /5 pozycji nadal mają /
    );
  });
});
