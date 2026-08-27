/**
 * Macierz logiczna Do ZD: stock need × extra × overlap × policy × extraOnly.
 * Formuła UI/serwera: packaging(combine(stockNeed, max(0, rawExtra − overlap), policy)).
 */
import { describe, expect, it } from "vitest";
import {
  filterOrderableLinesWithPackaging,
  resolveOrderQtyForLine,
} from "./zd-estimate-packaging";
import {
  collectTwIdsNeedingProsbaReservationOverlap,
  collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez,
  hasMatchableProsbaOverlapIdentity,
  individualExtraPiecesMapWithReservationOverlap,
  sumProsbaZkReservationOverlapPieces,
} from "./zd-estimate-prosba-reservation-overlap";
import type { ManualZdEstimateLine } from "./zd-estimate-manual";

function soloLine(input: {
  twId?: number;
  cel: number;
  dostepne: number;
  stanRez?: number;
  otwarteZd?: number;
}): ManualZdEstimateLine {
  const tw = input.twId ?? 1;
  return {
    tw_Id: tw,
    tw_Symbol: `S${tw}`,
    tw_Nazwa: "X",
    tw_IdGrupa: null,
    grt_Nazwa: "—",
    tw_Stan: input.dostepne + (input.stanRez ?? 0),
    tw_StanRez: input.stanRez ?? 0,
    dostepne: input.dostepne,
    sprzedazOkres: 0,
    wzNiepowiazaneOkres: 0,
    sprzedazDziennie: 0,
    celZapasu: input.cel,
    celZapasuTracked: input.cel,
    salesTrackDelta: 0,
    salesTrackReasons: [],
    salesTrackConfidence: 0,
    salesTrackQtyReview: false,
    salesTrackHeldExtraQty: 0,
    salesTrackAllowedExtraQty: 0,
    otwarteZkBezRez: 0,
    otwarteZkZarezerwowane: 0,
    otwarteZd: input.otwarteZd ?? 0,
    doZamowieniaApi: 0,
    doZamowieniaReczne: Math.max(
      0,
      Math.ceil(input.cel - input.dostepne - (input.otwarteZd ?? 0))
    ),
    wkladZk: 0,
  } as ManualZdEstimateLine;
}

function zdUnits(input: {
  cel: number;
  dostepne: number;
  rawExtra: number;
  overlap: number;
  policy?: "sum" | "max";
  extraOnly?: boolean;
  units?: number;
  otwarteZd?: number;
  relief?: number;
}): number {
  return resolveOrderQtyForLine(
    soloLine({
      cel: input.cel,
      dostepne: input.dostepne,
      otwarteZd: input.otwarteZd,
    }),
    {
      unitsPerPackage: input.units ?? 1,
      packageLabel: input.units && input.units > 1 ? "op." : "szt",
    },
    input.rawExtra,
    input.extraOnly === true,
    input.policy ?? "sum",
    input.relief ?? 0,
    input.overlap
  ).zdUnits;
}

describe("Do ZD macierz — stock / extra / overlap / policy", () => {
  it("tylko stock need", () => {
    expect(
      zdUnits({ cel: 10, dostepne: 3, rawExtra: 0, overlap: 0 })
    ).toBe(7);
  });

  it("tylko prośba (need=0)", () => {
    expect(
      zdUnits({ cel: 5, dostepne: 5, rawExtra: 4, overlap: 0 })
    ).toBe(4);
  });

  it("need + extra, różni klienci (overlap 0, sum)", () => {
    expect(
      zdUnits({
        cel: 10,
        dostepne: 5,
        rawExtra: 3,
        overlap: 0,
        policy: "sum",
      })
    ).toBe(8);
  });

  it("need + extra, max: nie dubluje gdy extra ≤ need", () => {
    expect(
      zdUnits({
        cel: 10,
        dostepne: 5,
        rawExtra: 3,
        overlap: 0,
        policy: "max",
      })
    ).toBe(5);
    expect(
      zdUnits({
        cel: 10,
        dostepne: 5,
        rawExtra: 9,
        overlap: 0,
        policy: "max",
      })
    ).toBe(9);
  });

  it("ten sam klient: pełny overlap → tylko need (scenariusz 1+1→1)", () => {
    // stanRez=1 → dostepne spada; need=1; extra overlap=1 → Do ZD=1
    expect(
      zdUnits({
        cel: 5,
        dostepne: 4,
        rawExtra: 1,
        overlap: 1,
        policy: "sum",
      })
    ).toBe(1);
  });

  it("ten sam klient: częściowy overlap", () => {
    // need=2, extra 5−2=3 → sum 5
    expect(
      zdUnits({
        cel: 10,
        dostepne: 8,
        rawExtra: 5,
        overlap: 2,
        policy: "sum",
      })
    ).toBe(5);
  });

  it("pełny overlap + need 0 → Do ZD = extra (overlap limitujemy need)", () => {
    expect(
      zdUnits({ cel: 5, dostepne: 5, rawExtra: 3, overlap: 3 })
    ).toBe(3);
  });

  it("extraOnly + overlap: baza 0 → pełna prośba (overlap nie obcina)", () => {
    expect(
      zdUnits({
        cel: 100,
        dostepne: 0,
        rawExtra: 5,
        overlap: 2,
        extraOnly: true,
      })
    ).toBe(5);
    expect(
      zdUnits({
        cel: 100,
        dostepne: 0,
        rawExtra: 5,
        overlap: 5,
        extraOnly: true,
      })
    ).toBe(5);
  });

  it("opakowanie Mode A: ceil(pieces / N) paczek", () => {
    expect(
      zdUnits({
        cel: 10,
        dostepne: 9,
        rawExtra: 1,
        overlap: 0,
        units: 10,
        policy: "sum",
      })
    ).toBe(1); // 2 szt → 1 op.
  });

  it("max + overlap: effective extra po odjęciu, potem max(need, extra)", () => {
    // need=5, rawExtra=5, overlap=2 → effective=3 → max(5,3)=5
    expect(
      zdUnits({
        cel: 10,
        dostepne: 5,
        rawExtra: 5,
        overlap: 2,
        policy: "max",
      })
    ).toBe(5);
    // need=2, effective=5 → max=5
    expect(
      zdUnits({
        cel: 10,
        dostepne: 8,
        rawExtra: 7,
        overlap: 2,
        policy: "max",
      })
    ).toBe(5);
  });
});

describe("Do ZD — atrybucja overlap (pula rez.)", () => {
  it("dwie prośby tego klienta — rez. zużyta raz", () => {
    expect(
      sumProsbaZkReservationOverlapPieces(
        [
          { orderId: "a", qty: 2, salesClientKhId: 1, sourceZkNumber: null },
          { orderId: "b", qty: 2, salesClientKhId: 1, sourceZkNumber: null },
        ],
        [{ quantity: 3, clientKhId: 1, zkNumber: "ZK 1" }]
      )
    ).toBe(3);
  });

  it("bez kh i bez sourceZk → brak matchu (fail-open identity)", () => {
    expect(
      hasMatchableProsbaOverlapIdentity([
        { orderId: "x", qty: 1, salesClientKhId: null, sourceZkNumber: null },
      ])
    ).toBe(false);
    expect(
      sumProsbaZkReservationOverlapPieces(
        [{ orderId: "x", qty: 1, salesClientKhId: null, sourceZkNumber: null }],
        [{ quantity: 9, clientKhId: 1, zkNumber: "ZK 1" }]
      )
    ).toBe(0);
  });
});

describe("Do ZD — kandydaci fetch ZK", () => {
  it("wymaga stanRez > 0 oraz tożsamości gdy byTwId podane", () => {
    const byTwId = new Map([
      [
        1,
        {
          extraPieces: 1,
          overlapContributions: [
            {
              orderId: "o",
              qty: 1,
              salesClientKhId: 9,
              sourceZkNumber: null,
            },
          ],
        },
      ],
      [
        2,
        {
          extraPieces: 1,
          overlapContributions: [
            {
              orderId: "p",
              qty: 1,
              salesClientKhId: null,
              sourceZkNumber: null,
            },
          ],
        },
      ],
      [
        3,
        {
          extraPieces: 1,
          overlapContributions: [
            {
              orderId: "q",
              qty: 1,
              salesClientKhId: 9,
              sourceZkNumber: null,
            },
          ],
        },
      ],
    ]);
    expect(
      collectTwIdsNeedingProsbaReservationOverlap({
        extraTwIds: [1, 2, 3],
        lines: [
          { tw_Id: 1, tw_StanRez: 2 },
          { tw_Id: 2, tw_StanRez: 2 },
          { tw_Id: 3, tw_StanRez: 0 },
        ],
        byTwId,
      })
    ).toEqual([1]);
  });

  it("Create bez stanRez: tylko matchable identity", () => {
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
                  salesClientKhId: 7,
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

describe("Do ZD — własny source_zk nie zeruje prośby", () => {
  it("prośba 3 + rez. 3 na tym samym ZK → effective extra 3", () => {
    const byTw = new Map([
      [
        50,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 3,
              salesClientKhId: 10,
              sourceZkNumber: "ZK 1",
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 10, zkNumber: "ZK 1" }]],
    ]);
    const adjusted = individualExtraPiecesMapWithReservationOverlap(
      byTw,
      reserved
    );
    expect(adjusted.get(50)).toBe(3);
    expect(
      zdUnits({
        cel: 0,
        dostepne: 10,
        rawExtra: 3,
        overlap: 0,
        extraOnly: true,
      })
    ).toBe(3);
  });
});

describe("Do ZD — orderable przy full overlap + extraOnly", () => {
  it("linia widoczna i Do ZD = 3 (need=0 → overlap nie zeruje prośby)", () => {
    const lines = [
      soloLine({ twId: 50, cel: 0, dostepne: 7, stanRez: 3 }),
    ];
    const byTw = new Map([
      [
        50,
        {
          extraPieces: 3,
          overlapContributions: [
            {
              orderId: "o1",
              qty: 3,
              salesClientKhId: 10,
              sourceZkNumber: null,
            },
          ],
        },
      ],
    ]);
    const reserved = new Map([
      [50, [{ quantity: 3, clientKhId: 10, zkNumber: "ZK 1" }]],
    ]);
    const maps = {
      extra: new Map([[50, 3]]),
      overlap: new Map([[50, 3]]),
    };
    // sanity: uncapped adjusted byłoby 0
    expect(
      individualExtraPiecesMapWithReservationOverlap(byTw, reserved).has(50)
    ).toBe(false);
    const pack = new Map([[50, { unitsPerPackage: 1, packageLabel: "szt" }]]);
    const orderable = filterOrderableLinesWithPackaging(
      lines,
      pack,
      new Set(),
      maps.extra,
      null,
      new Set([50]),
      "sum",
      maps.extra,
      null,
      maps.overlap
    );
    expect(orderable.map((l) => l.tw_Id)).toEqual([50]);
    expect(
      resolveOrderQtyForLine(
        lines[0]!,
        pack.get(50),
        3,
        true,
        "sum",
        0,
        3
      ).zdUnits
    ).toBe(3);
  });
});
