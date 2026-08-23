import { describe, expect, it } from "vitest";
import {
  applyOverlapToExtraPieces,
  collectTwIdsNeedingProsbaReservationOverlap,
  collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez,
  computeProsbaZkReservationDedupe,
  hasMatchableProsbaOverlapIdentity,
  individualExtraPiecesMapWithReservationOverlap,
  individualExtrasAndReliefWithReservationOverlap,
  mapProsbaReservedOverlapDto,
  normalizeZdEstimateZkNumberKey,
  resolveIndividualExtraPiecesMap,
  resolveProsbaReservationDedupeMaps,
  sumProsbaZkReservationOverlapPieces,
} from "./zd-estimate-prosba-reservation-overlap";
import { resolveOrderQtyForLine } from "./zd-estimate-packaging";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

describe("normalizeZdEstimateZkNumberKey", () => {
  it("usuwa prefiks ZK i spacje", () => {
    expect(normalizeZdEstimateZkNumberKey("ZK 1/M/08/2026")).toBe("1/m/08/2026");
    expect(normalizeZdEstimateZkNumberKey("zk1/M/08/2026")).toBe("1/m/08/2026");
    expect(normalizeZdEstimateZkNumberKey("1/M/08/2026")).toBe("1/m/08/2026");
  });
});

describe("computeProsbaZkReservationDedupe", () => {
  it("prośba 3 + rez. 3 na własnym source_zk → relief 3, overlap extra 0", () => {
    expect(
      computeProsbaZkReservationDedupe(
        [
          {
            orderId: "o1",
            qty: 3,
            salesClientKhId: 100,
            sourceZkNumber: "ZK 9/M/08/2026",
          },
        ],
        [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 9/M/08/2026" }]
      )
    ).toEqual({ extraOverlap: 0, stockNeedRelief: 3 });
  });

  it("bez sourceZk: rez. tego kh → extraOverlap (stary dedupe 1+1)", () => {
    expect(
      computeProsbaZkReservationDedupe(
        [{ orderId: "o1", qty: 1, salesClientKhId: 100, sourceZkNumber: null }],
        [{ quantity: 1, clientKhId: 100, zkNumber: "ZK 1" }]
      )
    ).toEqual({ extraOverlap: 1, stockNeedRelief: 0 });
  });

  it("własny ZK → relief; inny ZK tego klienta → extraOverlap", () => {
    expect(
      computeProsbaZkReservationDedupe(
        [
          {
            orderId: "o1",
            qty: 5,
            salesClientKhId: 100,
            sourceZkNumber: "ZK 1",
          },
        ],
        [
          { quantity: 3, clientKhId: 100, zkNumber: "ZK 1" },
          { quantity: 2, clientKhId: 100, zkNumber: "ZK 2" },
        ]
      )
    ).toEqual({ extraOverlap: 2, stockNeedRelief: 3 });
  });

  it("sam source_zk bez kh → relief na własnym ZK, bez extraOverlap", () => {
    expect(
      computeProsbaZkReservationDedupe(
        [
          {
            orderId: "o1",
            qty: 3,
            salesClientKhId: null,
            sourceZkNumber: "ZK 9/M/08/2026",
          },
        ],
        [{ quantity: 3, clientKhId: 55, zkNumber: "ZK 9/M/08/2026" }]
      )
    ).toEqual({ extraOverlap: 0, stockNeedRelief: 3 });
  });

  it("source_zk w formie skróconej (serial) ≡ pełny numer z API", () => {
    expect(
      computeProsbaZkReservationDedupe(
        [
          {
            orderId: "o1",
            qty: 3,
            salesClientKhId: 100,
            sourceZkNumber: "153157",
          },
        ],
        [
          {
            quantity: 3,
            clientKhId: 100,
            zkNumber: "ZK 153157/M/04/2026",
          },
        ]
      )
    ).toEqual({ extraOverlap: 0, stockNeedRelief: 3 });
  });
});

describe("sumProsbaZkReservationOverlapPieces", () => {
  it("zwraca tylko extraOverlap", () => {
    expect(
      sumProsbaZkReservationOverlapPieces(
        [
          {
            orderId: "o1",
            qty: 3,
            salesClientKhId: 100,
            sourceZkNumber: "ZK 1",
          },
        ],
        [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 1" }]
      )
    ).toBe(0);
  });
});

describe("Do ZD end-to-end: prośba z własnym ZK", () => {
  function line(partial: Partial<ManualZdEstimateLine>): ManualZdEstimateLine {
    return {
      tw_Id: 50,
      tw_Symbol: "S50",
      tw_Nazwa: "X",
      tw_IdGrupa: null,
      grt_Nazwa: "—",
      tw_Stan: 10,
      tw_StanRez: 3,
      dostepne: 7,
      sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
      sprzedazDziennie: 0,
      celZapasu: 7,
      celZapasuTracked: 7,
      salesTrackDelta: 0,
      salesTrackReasons: [],
      salesTrackConfidence: 0,
      salesTrackQtyReview: false,
      salesTrackHeldExtraQty: 0,
      salesTrackAllowedExtraQty: 0,
      otwarteZkBezRez: 0,
      otwarteZkZarezerwowane: 3,
      otwarteZd: 0,
      doZamowieniaApi: 0,
      doZamowieniaReczne: 0,
      wkladZk: 0,
      ...partial,
    } as ManualZdEstimateLine;
  }

  it("extraOnly: prośba 3 + rez. 3 → Do ZD 3 (overlap ograniczony need=0)", () => {
    const byTw = new Map([
      [
        50,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 3,
              salesClientKhId: 100,
              sourceZkNumber: null,
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 1" }]],
    ]);
    const maps = individualExtrasAndReliefWithReservationOverlap(byTw, reserved);
    expect(maps.extraByTwId.get(50)).toBe(3);
    expect(maps.extraOverlapByTwId.get(50)).toBe(3);
    expect(
      resolveOrderQtyForLine(
        line({ celZapasu: 0, celZapasuTracked: 0, doZamowieniaReczne: 0 }),
        { unitsPerPackage: 1, packageLabel: "szt" },
        maps.extraByTwId.get(50),
        true,
        "sum",
        maps.stockNeedReliefByTwId.get(50) ?? 0,
        maps.extraOverlapByTwId.get(50) ?? 0
      ).zdUnits
    ).toBe(3);
  });

  it("extraOnly: prośba 3 + rez. 3 na source_zk → Do ZD 3 (nie 0)", () => {
    const byTw = new Map([
      [
        50,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 3,
              salesClientKhId: 100,
              sourceZkNumber: "ZK 1/M/08/2026",
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 1/M/08/2026" }]],
    ]);
    const maps = individualExtrasAndReliefWithReservationOverlap(byTw, reserved);
    expect(maps.extraByTwId.get(50)).toBe(3);
    expect(maps.stockNeedReliefByTwId.get(50)).toBe(3);
    expect(
      resolveOrderQtyForLine(
        line({ celZapasu: 0, celZapasuTracked: 0, doZamowieniaReczne: 0 }),
        { unitsPerPackage: 1, packageLabel: "szt" },
        maps.extraByTwId.get(50),
        true,
        "sum",
        maps.stockNeedReliefByTwId.get(50) ?? 0,
        maps.extraOverlapByTwId.get(50) ?? 0
      ).zdUnits
    ).toBe(3);
  });

  it("stock: need ze stanRez + prośba z source_zk → Do ZD 3 (nie 0 i nie 6)", () => {
    // cel=10, dostepne=7 (stan 10 − rez 3) → need 3; extra 3; relief 3 → need' 0 + extra 3 = 3
    const byTw = new Map([
      [
        50,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 3,
              salesClientKhId: 100,
              sourceZkNumber: "ZK 1",
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 1" }]],
    ]);
    const maps = individualExtrasAndReliefWithReservationOverlap(byTw, reserved);
    expect(
      resolveOrderQtyForLine(
        line({
          celZapasu: 10,
          celZapasuTracked: 10,
          dostepne: 7,
          tw_StanRez: 3,
        }),
        { unitsPerPackage: 1, packageLabel: "szt" },
        maps.extraByTwId.get(50),
        false,
        "sum",
        maps.stockNeedReliefByTwId.get(50) ?? 0,
        maps.extraOverlapByTwId.get(50) ?? 0
      ).zdUnits
    ).toBe(3);
  });
});

describe("applyOverlapToExtraPieces", () => {
  it("Do ZD: need+extra bez dublowania → effective extra 0", () => {
    expect(applyOverlapToExtraPieces(1, 1)).toBe(0);
    expect(applyOverlapToExtraPieces(2, 1)).toBe(1);
  });
});

describe("individualExtraPiecesMapWithReservationOverlap", () => {
  it("prośba bez sourceZk + rez. tego kh → effective extra 0", () => {
    const byTwId = new Map([
      [
        7598,
        {
          extraPieces: 1,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 1,
              salesClientKhId: 4242,
              sourceZkNumber: null,
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [
        7598,
        [{ quantity: 1, clientKhId: 4242, zkNumber: "ZK 12/M/08/2026" }],
      ],
    ]);
    const map = individualExtraPiecesMapWithReservationOverlap(byTwId, reserved);
    expect(map.has(7598)).toBe(false);
  });

  it("prośba 3 z source_zk = rez. ZK → zostaje extra 3", () => {
    const byTwId = new Map([
      [
        50,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 3,
              salesClientKhId: 100,
              sourceZkNumber: "ZK 12/M/08/2026",
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 100, zkNumber: "ZK 12/M/08/2026" }]],
    ]);
    expect(
      individualExtraPiecesMapWithReservationOverlap(byTwId, reserved).get(50)
    ).toBe(3);
  });
});

describe("hasMatchableProsbaOverlapIdentity", () => {
  it("kh albo source_zk", () => {
    expect(
      hasMatchableProsbaOverlapIdentity([
        {
          orderId: "a",
          qty: 1,
          salesClientKhId: null,
          sourceZkNumber: "ZK 1",
        },
      ])
    ).toBe(true);
    expect(
      hasMatchableProsbaOverlapIdentity([
        {
          orderId: "a",
          qty: 1,
          salesClientKhId: 9,
          sourceZkNumber: null,
        },
      ])
    ).toBe(true);
    expect(
      hasMatchableProsbaOverlapIdentity([
        {
          orderId: "a",
          qty: 1,
          salesClientKhId: null,
          sourceZkNumber: null,
        },
      ])
    ).toBe(false);
  });
});

describe("collectTwIdsNeedingProsbaReservationOverlap", () => {
  it("tylko tw z extra i stanRez > 0", () => {
    expect(
      collectTwIdsNeedingProsbaReservationOverlap({
        extraTwIds: [1, 2, 3],
        lines: [
          { tw_Id: 1, tw_StanRez: 2 },
          { tw_Id: 2, tw_StanRez: 0 },
          { tw_Id: 3, tw_StanRez: 1 },
        ],
      })
    ).toEqual([1, 3]);
  });
});

describe("collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez", () => {
  it("kh lub source_zk", () => {
    expect(
      collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez({
        byTwId: new Map([
          [
            10,
            {
              extraPieces: 2,
              overlapContributions: [
                {
                  orderId: "a",
                  qty: 2,
                  salesClientKhId: null,
                  sourceZkNumber: "ZK 1",
                },
              ],
            },
          ],
          [
            11,
            {
              extraPieces: 1,
              overlapContributions: [
                {
                  orderId: "b",
                  qty: 1,
                  salesClientKhId: null,
                  sourceZkNumber: null,
                },
              ],
            },
          ],
        ]),
      })
    ).toEqual([10]);
  });
});

describe("resolveProsbaReservationDedupeMaps", () => {
  const byTwId = new Map([
    [
      10,
      {
        extraPieces: 2,
        overlapContributions: [
          {
            orderId: "o1",
            qty: 2,
            salesClientKhId: 100,
            sourceZkNumber: null,
          },
        ],
      },
    ],
  ]);

  it("null reserved → surowe extra, bez relief/overlap", () => {
    const m = resolveProsbaReservationDedupeMaps(byTwId, null);
    expect(m.extraByTwId.get(10)).toBe(2);
    expect(m.extraOverlapByTwId.size).toBe(0);
    expect(m.stockNeedReliefByTwId.size).toBe(0);
  });

  it("resolveIndividualExtraPiecesMap deleguje extra", () => {
    expect(resolveIndividualExtraPiecesMap(byTwId, null).get(10)).toBe(2);
  });
});

describe("mapProsbaReservedOverlapDto", () => {
  it("pomija puste i niepoprawne klucze", () => {
    const map = mapProsbaReservedOverlapDto({
      "10": [{ quantity: 1, clientKhId: 1, zkNumber: "ZK 1" }],
      "0": [{ quantity: 9, clientKhId: 1, zkNumber: "ZK 2" }],
      bad: [],
    });
    expect([...map.keys()]).toEqual([10]);
  });
});
