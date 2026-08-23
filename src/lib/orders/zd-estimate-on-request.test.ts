import { describe, expect, it } from "vitest";
import {
  buildBakeExcludedTwIds,
  buildExtraOnlyTwIds,
  buildOrderExcludedTwIds,
  buildReclassifyExcludedTwIds,
  filterSessionIncludeRespectingOnRequest,
  onRequestIdsToClearForExcludedTw,
  onRequestIdsToClearForTw,
  onRequestTwIdSet,
  retargetTwIdToPackIfPiece,
} from "./zd-estimate-on-request";
import {
  resolveOrderQtyForLine,
  summarizePackOrderQty,
  type PackagingLookup,
} from "./zd-estimate-packaging";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";
import {
  reclassifyExcludedTwExtrasToServices,
  type ZdEstimateIndividualBundle,
  type ZdEstimateIndividualRequestRef,
} from "./zd-estimate-individual";

describe("zd-estimate-on-request sets", () => {
  const hard = new Set([1, 2]);
  const onReq = new Set([2, 3, 4]);

  it("onRequestTwIdSet", () => {
    expect(onRequestTwIdSet([{ subiektTwId: 3 }, { subiektTwId: 0 }])).toEqual(
      new Set([3])
    );
  });

  it("onRequestTwIdSet retargetuje piece→pack przy odczycie", () => {
    const pairs = [{ packTwId: 100, pieceTwId: 200 }];
    expect(
      onRequestTwIdSet([{ subiektTwId: 200 }, { subiektTwId: 50 }], pairs)
    ).toEqual(new Set([100, 50]));
  });

  it("onRequestIdsToClearForTw czyści piece i pack (jawne Usuń)", () => {
    const pairs = [{ packTwId: 100, pieceTwId: 200 }];
    expect(onRequestIdsToClearForTw(200, pairs).sort()).toEqual([100, 200]);
    expect(onRequestIdsToClearForTw(100, pairs).sort()).toEqual([100, 200]);
  });

  it("onRequestIdsToClearForExcludedTw: piece nie kasuje packa", () => {
    const pairs = [{ packTwId: 100, pieceTwId: 200 }];
    expect(onRequestIdsToClearForExcludedTw(200, pairs)).toEqual([200]);
    expect(onRequestIdsToClearForExcludedTw(100, pairs).sort()).toEqual([
      100, 200,
    ]);
  });

  it("extraOnly = onRequest ∩ extras>0", () => {
    const extras = new Map([
      [3, 10],
      [4, 0],
      [9, 5],
    ]);
    expect(buildExtraOnlyTwIds(onReq, extras)).toEqual(new Set([3]));
  });

  it("bake zawsze zawiera całe onRequest", () => {
    expect(buildBakeExcludedTwIds(hard, onReq)).toEqual(new Set([1, 2, 3, 4]));
  });

  it("orderExcluded = hard ∪ (onRequest − extraOnly)", () => {
    const extraOnly = new Set([3]);
    expect(buildOrderExcludedTwIds(hard, onReq, extraOnly)).toEqual(
      new Set([1, 2, 4])
    );
    expect(buildReclassifyExcludedTwIds(hard, onReq, extraOnly)).toEqual(
      new Set([1, 2, 4])
    );
  });

  it("bez prośby → orderExcluded; z prośbą → extraOnly, nie w reclassify", () => {
    const onRequest = new Set([10, 20]);
    const extras = new Map([[20, 7]]);
    const extraOnly = buildExtraOnlyTwIds(onRequest, extras);
    expect(extraOnly).toEqual(new Set([20]));
    const order = buildOrderExcludedTwIds(new Set(), onRequest, extraOnly);
    expect(order.has(10)).toBe(true);
    expect(order.has(20)).toBe(false);
    expect(
      buildReclassifyExcludedTwIds(new Set(), onRequest, extraOnly).has(20)
    ).toBe(false);
  });

  it("session include nie zdejmuje on-request", () => {
    expect(
      filterSessionIncludeRespectingOnRequest(new Set([3, 5]), onReq)
    ).toEqual(new Set([5]));
    expect(
      filterSessionIncludeRespectingOnRequest({ 3: true, 5: true }, onReq)
    ).toEqual(new Set([5]));
  });

  it("piece → pack retarget", () => {
    const pairs = [{ packTwId: 100, pieceTwId: 200 }];
    expect(retargetTwIdToPackIfPiece(200, pairs)).toEqual({
      twId: 100,
      retargeted: true,
      pair: { packTwId: 100, pieceTwId: 200 },
    });
    expect(retargetTwIdToPackIfPiece(100, pairs).retargeted).toBe(false);
    expect(retargetTwIdToPackIfPiece(999, pairs).retargeted).toBe(false);
  });
});

describe("hard exclude vs on-request reclassify", () => {
  function req(qty: number): ZdEstimateIndividualRequestRef {
    return {
      orderId: "o1",
      salesPersonId: "s1",
      salesPersonName: "A",
      qty,
      products: "Prod",
      symbol: "SYM",
      mikranCode: null,
      requestNote: null,
      salesClientKhId: null,
      sourceZkNumber: null,
    };
  }

  it("hard exclude + prośba → service; on-request + prośba → katalog", () => {
    const hard = new Set([1]);
    const onRequest = new Set([2]);
    const extrasMap = new Map([
      [1, 5],
      [2, 8],
    ]);
    const extraOnly = buildExtraOnlyTwIds(onRequest, extrasMap);
    const reclassify = buildReclassifyExcludedTwIds(hard, onRequest, extraOnly);

    expect(reclassify.has(1)).toBe(true);
    expect(reclassify.has(2)).toBe(false);

    const merged: ZdEstimateIndividualBundle = {
      byTwId: new Map([
        [1, { extraPieces: 5, requests: [req(5)] }],
        [2, { extraPieces: 8, requests: [{ ...req(8), orderId: "o2" }] }],
      ]),
      serviceLines: [],
      twIdsToFetch: [],
      meta: {
        orderCount: 2,
        extraPiecesSum: 13,
        serviceCount: 0,
        skippedNoQty: 0,
      },
    };

    const out = reclassifyExcludedTwExtrasToServices(merged, reclassify);
    expect(out.byTwId.has(1)).toBe(false);
    expect(out.byTwId.has(2)).toBe(true);
    expect(out.serviceLines.some((l) => l.reason === "excluded")).toBe(true);
  });
});

describe("on-request summarize KPI (extra_only)", () => {
  function line(
    partial: Partial<ManualZdEstimateLine> & { tw_Id: number }
  ): ManualZdEstimateLine {
    return {
      tw_Symbol: "X",
      tw_Nazwa: "X",
      sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
      stan: 0,
      naZamowieniach: 0,
      celZapasu: 1000,
      doZamowienia: 0,
      doZamowieniaReczne: 500,
      ...partial,
    } as ManualZdEstimateLine;
  }

  it("lifted: Do ZD = ceil(extra); soft bez prośby skip", () => {
    const pack: PackagingLookup = { unitsPerPackage: 10, packageLabel: "op." };
    const packaging = new Map([[50, pack]]);
    const lines = [
      line({ tw_Id: 50, doZamowieniaReczne: 500 }),
      line({ tw_Id: 60, doZamowieniaReczne: 0 }),
    ];
    const onRequest = new Set([50, 60]);
    const extras = new Map([[50, 25]]);
    const extraOnly = buildExtraOnlyTwIds(onRequest, extras);
    const orderExcluded = buildOrderExcludedTwIds(
      new Set(),
      onRequest,
      extraOnly
    );

    const sum = summarizePackOrderQty(
      lines,
      packaging,
      orderExcluded,
      extras,
      null,
      extraOnly
    );
    expect(orderExcluded.has(60)).toBe(true);
    expect(extraOnly.has(50)).toBe(true);
    expect(sum.doZamowieniaCount).toBe(1);
    expect(sum.zdUnitsSuma).toBe(3); // ceil(25/10)

    const qty = resolveOrderQtyForLine(lines[0]!, pack, 25, true);
    expect(qty.zdUnits).toBe(3);
    expect(qty.piecesNeeded).toBe(25);
  });
});
