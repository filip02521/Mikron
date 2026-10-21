/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { TransitionStartFunction } from "react";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import type { ZdProductPairRow } from "@/lib/data/zd-product-pairs";
import type { ZdEstimateOnRequestRow } from "@/lib/data/zd-estimate-on-request";
import { policyForBoostPreset } from "@/lib/orders/zd-estimate-boost-presets";
import {
  useZdEstimateRulesData,
  useZdEstimateRulesLiveApply,
} from "./useZdEstimateRules";

function line(twId: number): ManualZdEstimateLine {
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
  };
}

describe("useZdEstimateRulesLiveApply — zapis pary", () => {
  it("„tylko na prośbę” na sztuce przechodzi na opakowanie z nowej pary", () => {
    const setLines = vi.fn<(lines: ManualZdEstimateLine[]) => void>();
    const startRemat = ((fn: () => void) => fn()) as TransitionStartFunction;
    const { result } = renderHook(() => {
      const rules = useZdEstimateRulesData({
        exclusions: [],
        exclusionsError: null,
        onRequests: [{ subiektTwId: 200 } as ZdEstimateOnRequestRow],
        onRequestsError: null,
        packaging: [],
        packagingError: null,
        productPairs: [],
        productPairsError: null,
      });
      return useZdEstimateRulesLiveApply({
        rules,
        linesBase: [line(100), line(200)],
        sessionIncludeTwIds: {},
        dniZapasu: "30",
        paramInfo: { dniZapasu: 30, dniOkresu: 30 },
        zapasMin: "0",
        historyByTwId: new Map(),
        appliedBoostPolicy: policyForBoostPreset("standard"),
        canAutoRecount: false,
        startRemat,
        setLines,
        setMissingPartnerTwIds: () => {},
        setMissingBomTwIds: () => {},
        flashSettingsLive: () => {},
        runEstimateRef: { current: () => {} },
      });
    });

    act(() => {
      result.current.applyPairsMutation([
        { packTwId: 100, pieceTwId: 200, unitsPerPack: 10 } as ZdProductPairRow,
      ]);
    });

    const lines = setLines.mock.calls.at(-1)![0];
    const pack = lines.find((l) => l.tw_Id === 100)!;
    expect(pack.pair?.role).toBe("pack");
    // Opakowanie „tylko na prośbę” (przez sztukę) — nic do zamówienia z automatu.
    expect(pack.doZamowieniaReczne).toBe(0);
  });
});
