import { describe, expect, it } from "vitest";
import {
  ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION,
  formatImplicitPieceSnapshotHint,
  zdEstimateCreateConfirmLabel,
  zdEstimateEmptyListDescription,
  zdEstimateHostBadgeLabel,
  zdEstimateLaunchFetchHint,
  zdEstimateLaunchProgressTitle,
  zdEstimatePageHint,
  zdEstimateReadyToCountHint,
  zdEstimateRecountOverlayHint,
  zdEstimateRouteLoadingSteps,
  zdEstimateRouteLoadingSubtitle,
  zdEstimateScopeChangedHint,
  zdEstimateScopeDashedHint,
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

  it("confirm live wskazuje katalogowe prośby", () => {
    const text = zdEstimateCreateConfirmLabel({
      isLive: true,
      port: 5080,
      markCount: 2,
    });
    expect(text).toMatch(/aktualnej bazie/);
    expect(text).toMatch(/katalogowe/);
  });

  it("route loading bez „dla dostawcy” i ze stałym flow description", () => {
    expect(ZD_ESTIMATE_PAGE_FLOW_DESCRIPTION).toMatch(/Zakres Subiekta/);
    expect(zdEstimateRouteLoadingSubtitle()).not.toMatch(/dla dostawcy/i);
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
    expect(zdEstimateReadyToCountHint()).toMatch(/Gotowe do policzenia/);
    expect(zdEstimateScopeChangedHint()).toMatch(/Zakres zmieniony/);
    expect(
      zdEstimateLaunchProgressTitle({ manualWithScope: true })
    ).toMatch(/Liczy listę/);
    expect(
      zdEstimateLaunchProgressTitle({ manualWithScope: false })
    ).toMatch(/Przygotowuję zamówienie/);
    expect(zdEstimateRecountOverlayHint(true)).toMatch(/aktualnej bazy/);
    expect(zdEstimateRecountOverlayHint(false)).toMatch(/testowego/);
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
});
