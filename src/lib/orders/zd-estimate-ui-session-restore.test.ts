import { describe, expect, it } from "vitest";
import {
  buildZdEstimateBakeExcludedTwIds,
  refreshZdEstimateLinesWithPairs,
} from "@/lib/orders/zd-estimate-live-refresh";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  recomputeRestoredZdEstimateLines,
  type ZdEstimateRestoreRules,
} from "@/lib/orders/zd-estimate-ui-session-restore";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";

function baseLine(
  twId: number,
  overrides: Partial<ManualZdEstimateLine> = {}
): ManualZdEstimateLine {
  return {
    tw_Id: twId,
    tw_Symbol: `S${twId}`,
    tw_Nazwa: `N${twId}`,
    tw_IdGrupa: 1,
    grt_Nazwa: "G",
    tw_Stan: 0,
    tw_StanRez: 0,
    dostepne: 0,
    sprzedazOkres: 33,
    wzNiepowiazaneOkres: 0,
    sprzedazDziennie: 1.1,
    celZapasu: 7,
    celZapasuTracked: 7,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: 7,
    wkladZk: 0,
    pair: null,
    ...overrides,
  };
}

const noRules: ZdEstimateRestoreRules = {
  exclusions: [],
  exclusionsTrusted: true,
  onRequests: [],
  onRequestTrusted: true,
  packaging: [],
  minStock: [],
  productPairs: [],
  productBoms: [],
  teethTwIds: [],
  teethTrusted: true,
};

function snapshot(linesBase: ManualZdEstimateLine[]) {
  return {
    linesBase,
    // Lista policzona przy starych regułach — przy restore ma zniknąć.
    lines: linesBase.map((l) => ({ ...l, doZamowieniaReczne: 999 })),
    missingPartnerTwIds: [],
    missingBomTwIds: [],
    paramInfo: { dniZapasu: 45, dniOkresu: 30 },
    dniZapasu: "14",
    zapasMin: "0",
    historyByTwId: [],
    boostPreset: "standard" as const,
    appliedBoostPreset: "standard" as const,
    sessionIncludeTwIds: {},
  };
}

describe("recomputeRestoredZdEstimateLines", () => {
  it("bez linesBase zostawia listę ze snapshotu", () => {
    const snap = { ...snapshot([]), lines: [baseLine(1)] };
    const out = recomputeRestoredZdEstimateLines(snap, noRules);
    expect(out.lines).toBe(snap.lines);
  });

  it("liczy z bieżącymi opakowaniami i dniami z Policz, nie z kopią listy", () => {
    const snap = snapshot([baseLine(1)]);
    const rules: ZdEstimateRestoreRules = {
      ...noRules,
      packaging: [
        {
          subiektTwId: 1,
          unitsPerPackage: 10,
          documentUnitMode: "packages",
          orderMultiple: null,
        },
      ] as unknown as ZdEstimateRestoreRules["packaging"],
    };
    const out = recomputeRestoredZdEstimateLines(snap, rules);
    const expected = refreshZdEstimateLinesWithPairs({
      linesBase: snap.linesBase,
      pairs: [],
      options: {
        dniZapasu: 45,
        dniOkresu: 30,
        zapasMin: 0,
        excludedTwIds: new Set(),
        packagingByTwId: new Map([
          [1, { unitsPerPackage: 10, documentUnitMode: "packages", orderMultiple: null }],
        ]),
        historyByTwId: null,
        salesTrackPolicy: policyForBoostPreset("standard"),
        minStockByTwId: new Map(),
      },
    });
    expect(out.lines).toEqual(expected.lines);
    expect(out.lines[0]!.doZamowieniaReczne).not.toBe(999);
  });

  it("para dodana w trakcie nieobecności scala towary po restore", () => {
    const snap = snapshot([baseLine(100), baseLine(200)]);
    const out = recomputeRestoredZdEstimateLines(snap, {
      ...noRules,
      productPairs: [
        { packTwId: 100, pieceTwId: 200, unitsPerPack: 10 },
      ] as unknown as ZdEstimateRestoreRules["productPairs"],
    });
    expect(out.lines.find((l) => l.tw_Id === 100)?.pair?.role).toBe("pack");
    expect(out.lines.find((l) => l.tw_Id === 200)?.pair?.role).toBe("piece");
    expect(out.missingPartnerTwIds).toEqual([]);
  });

});

describe("buildZdEstimateBakeExcludedTwIds", () => {
  const linesBase = [baseLine(1), baseLine(2), baseLine(3)];

  it("DB ∪ zęby ∪ na prośbę, minus włączone w sesji (poza „na prośbę”)", () => {
    const out = buildZdEstimateBakeExcludedTwIds({
      linesBase,
      dbExcludedTwIds: [1],
      teethTwIds: new Set([2]),
      sessionIncludeTwIds: { 1: true, 3: true },
      onRequestTwIds: new Set([3]),
    });
    expect([...out].sort()).toEqual([2, 3]);
  });

  it("niewczytana lista zębów (null) nie wyklucza", () => {
    const out = buildZdEstimateBakeExcludedTwIds({
      linesBase,
      dbExcludedTwIds: [],
      teethTwIds: null,
      sessionIncludeTwIds: {},
      onRequestTwIds: new Set(),
    });
    expect(out.size).toBe(0);
  });
});
