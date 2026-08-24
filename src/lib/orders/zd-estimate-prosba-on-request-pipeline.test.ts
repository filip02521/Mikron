import { describe, expect, it } from "vitest";
import {
  buildIndividualEstimateExtras,
  expandPresentTwIdsWithPairPartners,
  individualExtraPiecesMap,
  reclassifyExcludedTwExtrasToServices,
  reclassifyMissingTwExtrasToServices,
  type ZdEstimatePendingIndividualOrder,
} from "./zd-estimate-individual";
import {
  buildExtraOnlyTwIds,
  buildOrderExcludedTwIds,
  onRequestTwIdSet,
} from "./zd-estimate-on-request";
import {
  filterOrderableLinesWithPackaging,
  resolveOrderQtyForLine,
} from "./zd-estimate-packaging";
import {
  individualExtraPiecesMapWithReservationOverlap,
  resolveIndividualExtraPiecesMap,
  resolveProsbaReservationDedupeMaps,
} from "./zd-estimate-prosba-reservation-overlap";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

function pending(
  partial: Partial<ZdEstimatePendingIndividualOrder> & { id: string }
): ZdEstimatePendingIndividualOrder {
  return {
    salesPersonId: "sp1",
    salesPersonName: "Anna",
    products: "Produkt test",
    symbol: "SYM-ONREQ",
    mikranCode: null,
    subiektTwId: 50,
    qty: 3,
    requestNote: null,
    salesClientKhId: null,
    sourceZkNumber: null,
    ...partial,
  };
}

function line(twId: number): ManualZdEstimateLine {
  return {
    tw_Id: twId,
    tw_Symbol: twId === 50 ? "SYM-ONREQ" : `S${twId}`,
    tw_Nazwa: "X",
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: 10,
    tw_StanRez: 0,
    dostepne: 10,
    sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
    sprzedazDziennie: 0,
    celZapasu: 0,
    celZapasuTracked: 0,
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
    doZamowieniaReczne: 0,
    wkladZk: 0,
  } as ManualZdEstimateLine;
}

/**
 * Pipeline jak Workbench: catalog extras → missing → lift on-request → orderable.
 */
describe("Workbench pipeline: prośba + tylko na prośbę", () => {
  it("on-request z prośbą wchodzi do orderable z qty = extra", () => {
    const lines = [line(50), line(60)];
    const orders = [pending({ id: "o1", qty: 3, symbol: "SYM-ONREQ", subiektTwId: 50 })];
    const onRequest = onRequestTwIdSet([{ subiektTwId: 50 }]);

    const raw = buildIndividualEstimateExtras({
      orders,
      lines: lines.map((l) => ({ tw_Id: l.tw_Id, tw_Symbol: l.tw_Symbol })),
    });
    const catalog = reclassifyMissingTwExtrasToServices(
      raw,
      new Set(lines.map((l) => l.tw_Id))
    );
    const rawExtras = individualExtraPiecesMap(catalog);
    expect(rawExtras.get(50)).toBe(3);

    const extraOnly = buildExtraOnlyTwIds(onRequest, rawExtras);
    expect(extraOnly.has(50)).toBe(true);

    const orderExcluded = buildOrderExcludedTwIds(new Set(), onRequest, extraOnly);
    expect(orderExcluded.has(50)).toBe(false);
    // 60 nie jest „tylko na prośbę” — nie wchodzi do orderExcluded
    expect(orderExcluded.has(60)).toBe(false);

    const adjusted = resolveIndividualExtraPiecesMap(catalog.byTwId, null);
    const pack = new Map([
      [50, { unitsPerPackage: 1, packageLabel: "szt" }],
      [60, { unitsPerPackage: 1, packageLabel: "szt" }],
    ]);
    const orderable = filterOrderableLinesWithPackaging(
      lines,
      pack,
      orderExcluded,
      adjusted,
      null,
      extraOnly,
      "sum",
      rawExtras
    );
    expect(orderable.map((l) => l.tw_Id)).toContain(50);
    expect(resolveOrderQtyForLine(lines[0]!, pack.get(50), 3, true).zdUnits).toBe(3);
  });

  it("pełny overlap + extraOnly: Do ZD = 3 (nie 0), linia widoczna", () => {
    const lines = [line(50)];
    lines[0]!.tw_StanRez = 3;
    const orders = [
      pending({
        id: "o1",
        qty: 3,
        symbol: "SYM-ONREQ",
        subiektTwId: 50,
        salesClientKhId: 100,
      }),
    ];
    const onRequest = onRequestTwIdSet([{ subiektTwId: 50 }]);
    const raw = buildIndividualEstimateExtras({
      orders,
      lines: lines.map((l) => ({ tw_Id: l.tw_Id, tw_Symbol: l.tw_Symbol })),
    });
    const catalog = reclassifyMissingTwExtrasToServices(raw, new Set([50]));
    const rawExtras = individualExtraPiecesMap(catalog);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 1" }]],
    ]);
    const maps = resolveProsbaReservationDedupeMaps(catalog.byTwId, reserved);
    expect(maps.extraByTwId.get(50)).toBe(3);
    expect(maps.extraOverlapByTwId.get(50)).toBe(3);

    const extraOnly = buildExtraOnlyTwIds(onRequest, rawExtras);
    const orderExcluded = buildOrderExcludedTwIds(new Set(), onRequest, extraOnly);
    const pack = new Map([[50, { unitsPerPackage: 1, packageLabel: "szt" }]]);
    const orderable = filterOrderableLinesWithPackaging(
      lines,
      pack,
      orderExcluded,
      maps.extraByTwId,
      null,
      extraOnly,
      "sum",
      rawExtras,
      maps.stockNeedReliefByTwId,
      maps.extraOverlapByTwId
    );
    expect(orderable.map((l) => l.tw_Id)).toEqual([50]);
    expect(
      resolveOrderQtyForLine(
        lines[0]!,
        pack.get(50),
        maps.extraByTwId.get(50),
        true,
        "sum",
        0,
        maps.extraOverlapByTwId.get(50) ?? 0
      ).zdUnits
    ).toBe(3);
  });

  it("prośba z source_zk = rez. ZK: Do ZD = qty prośby (nie 0)", () => {
    const lines = [line(50)];
    lines[0]!.tw_StanRez = 3;
    const orders = [
      pending({
        id: "o1",
        qty: 3,
        symbol: "SYM-ONREQ",
        subiektTwId: 50,
        salesClientKhId: 100,
        sourceZkNumber: "ZK 1/M/08/2026",
      }),
    ];
    const onRequest = onRequestTwIdSet([{ subiektTwId: 50 }]);
    const raw = buildIndividualEstimateExtras({
      orders,
      lines: lines.map((l) => ({ tw_Id: l.tw_Id, tw_Symbol: l.tw_Symbol })),
    });
    const catalog = reclassifyMissingTwExtrasToServices(raw, new Set([50]));
    const rawExtras = individualExtraPiecesMap(catalog);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 1/M/08/2026" }]],
    ]);
    const adjusted = individualExtraPiecesMapWithReservationOverlap(
      catalog.byTwId,
      reserved
    );
    expect(adjusted.get(50)).toBe(3);

    const extraOnly = buildExtraOnlyTwIds(onRequest, rawExtras);
    expect(
      resolveOrderQtyForLine(
        lines[0]!,
        { unitsPerPackage: 1, packageLabel: "szt" },
        adjusted.get(50) ?? 0,
        true,
        "sum"
      ).zdUnits
    ).toBe(3);
    expect(extraOnly.has(50)).toBe(true);
  });

  it("piece w lines + pair: extra na pack nie spada do usług (expand present)", () => {
    const pairs = [{ packTwId: 100, pieceTwId: 200, unitsPerPack: 10 }];
    const orders = [
      pending({
        id: "o1",
        qty: 2,
        symbol: null,
        subiektTwId: 200,
        products: "Piece",
      }),
    ];
    const raw = buildIndividualEstimateExtras({
      orders,
      lines: [{ tw_Id: 200, tw_Symbol: "PIECE" }],
      pairs,
    });
    // Extra poszło na pack 100
    expect(raw.byTwId.has(100)).toBe(true);
    expect(raw.twIdsToFetch).toContain(100);

    const withoutExpand = reclassifyMissingTwExtrasToServices(raw, new Set([200]));
    expect(withoutExpand.byTwId.has(100)).toBe(false);
    expect(withoutExpand.serviceLines.length).toBeGreaterThan(0);

    const present = expandPresentTwIdsWithPairPartners(new Set([200]), pairs);
    expect(present.has(100)).toBe(true);
    const withExpand = reclassifyMissingTwExtrasToServices(raw, present);
    expect(withExpand.byTwId.has(100)).toBe(true);
    expect(withExpand.serviceLines).toHaveLength(0);
  });

  it("inna prośba missing nie kasuje extras na obecnym on-request tw", () => {
    const orders = [
      pending({ id: "keep", qty: 5, symbol: "SYM-ONREQ", subiektTwId: 50 }),
      pending({
        id: "gone",
        qty: 1,
        symbol: "MISSING",
        subiektTwId: 999,
        products: "Brak",
      }),
    ];
    const raw = buildIndividualEstimateExtras({
      orders,
      lines: [{ tw_Id: 50, tw_Symbol: "SYM-ONREQ" }],
    });
    expect(raw.byTwId.get(50)?.extraPieces).toBe(5);
    const next = reclassifyMissingTwExtrasToServices(raw, new Set([50]));
    expect(next.byTwId.get(50)?.extraPieces).toBe(5);
    expect(next.byTwId.has(999)).toBe(false);
  });

  it("hard exclude z prośbą → service; on-request z prośbą zostaje w katalogu", () => {
    const hard = new Set([1]);
    const onRequest = new Set([2]);
    const extrasMap = new Map([
      [1, 5],
      [2, 8],
    ]);
    const extraOnly = buildExtraOnlyTwIds(onRequest, extrasMap);
    const reclassify = buildOrderExcludedTwIds(hard, onRequest, extraOnly);
    expect(reclassify.has(2)).toBe(false);

    const merged = buildIndividualEstimateExtras({
      orders: [
        pending({ id: "h", qty: 5, symbol: "H", subiektTwId: 1 }),
        pending({ id: "o", qty: 8, symbol: "O", subiektTwId: 2 }),
      ],
      lines: [
        { tw_Id: 1, tw_Symbol: "H" },
        { tw_Id: 2, tw_Symbol: "O" },
      ],
    });
    const out = reclassifyExcludedTwExtrasToServices(merged, reclassify);
    expect(out.byTwId.has(2)).toBe(true);
    expect(out.byTwId.has(1)).toBe(false);
  });
});
