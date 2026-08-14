import { describe, expect, it } from "vitest";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  ZD_ESTIMATE_UI,
  formatImplicitPieceSnapshotHint,
  zdEstimateCreateConfirmLabel,
  zdEstimateEmptyListDescription,
  zdEstimateHostBadgeLabel,
  zdEstimateLaunchFetchHint,
  zdEstimateLaunchProgressTitle,
  zdEstimateLaunchProgressCompleteTitle,
  zdEstimateLaunchProgressCompleteHint,
  zdEstimateCreateProgressCompleteTitle,
  zdEstimateCreateProgressCompleteHint,
  zdEstimatePageHint,
  zdEstimateProsbaWord,
  zdEstimateProsbaWordAccusative,
  zdEstimateReadyToCountHint,
  zdEstimateRecountOverlayHint,
  zdEstimateRouteLoadingSteps,
  zdEstimateRouteLoadingSubtitle,
  zdEstimateRouteLoadingHint,
  zdEstimateScopeChangedHint,
  zdEstimateScopeDashedHint,
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
    expect(text).not.toMatch(/zostaną odznaczone jako Główne/);
  });

  it("route loading bez „dla dostawcy” i ze stałym flow description", () => {
    expect(ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION).toMatch(/Zakres Subiekta/);
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

  it("prep / launch / recount copy", () => {
    expect(zdEstimateScopeDashedHint("grupa")).toMatch(/Policz listę/);
    expect(zdEstimateScopeDashedHint("cecha")).toMatch(/Policz listę/);
    expect(zdEstimateReadyToCountHint()).toMatch(/Gotowe/);
    expect(zdEstimateScopeChangedHint()).toMatch(/Zakres zmieniony/);
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
      zdEstimateCreateProgressCompleteHint({ snapshotOk: false })
    ).toMatch(/Powiąż ZD/);
    expect(
      zdEstimateCreateProgressCompleteHint({ snapshotOk: true })
    ).toMatch(/zamykam/);
    expect(zdEstimateRecountOverlayHint(true)).toMatch(/aktualnej bazy/);
    expect(zdEstimateRecountOverlayHint(false)).toMatch(/testowego/);
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
    expect(zdEstimateSuppliersMenuAriaLabel(0)).toMatch(/mapowania zakresów/i);
    expect(zdEstimateSuppliersMenuAriaLabel(2)).toMatch(/bez mapowania/i);
    expect(zdEstimateSuppliersScopesItemSuffix(0)).toBe("");
    expect(zdEstimateSuppliersScopesItemSuffix(1)).toMatch(/bez mapowania/);
  });
});
