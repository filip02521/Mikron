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
  buildZdOverlapReservationSources,
  linesWithReservationSources,
  mergeReservedSlicesBySources,
  reservationSourceTwIds,
} from "./zd-estimate-prosba-reservation-overlap";
import { resolveOrderQtyForLine } from "./zd-estimate-packaging";
import { buildManualZdEstimateResult, type ManualZdEstimateLine } from "./zd-estimate-manual";

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
      grt_Nazwa: "-",
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

describe("computeProsbaZkReservationDedupe: kolejność próśb nie zmienia wyniku", () => {
  const A = { orderId: "A", qty: 3, salesClientKhId: 5, sourceZkNumber: "ZK 100/M/10/2026" };
  const B = { orderId: "B", qty: 3, salesClientKhId: 5, sourceZkNumber: null };
  const reserved = [{ quantity: 3, clientKhId: 5, zkNumber: "ZK 100/M/10/2026" }];
  it("rezerwacja własnego ZK prośby A to ulga, także gdy B (bez ZK) jest pierwsza", () => {
    const want = { extraOverlap: 0, stockNeedRelief: 3 };
    expect(computeProsbaZkReservationDedupe([A, B], reserved)).toEqual(want);
    expect(computeProsbaZkReservationDedupe([B, A], reserved)).toEqual(want);
  });
});

describe("rezerwacje z innej karty niż prośba (para, zestaw „Składamy”)", () => {
  it("para: ZK klienta na karcie sztuki zdejmuje prośbę tego klienta", () => {
    const sources = buildZdOverlapReservationSources({ pairs: [{ packTwId: 20, pieceTwId: 21, unitsPerPack: 2 }] });
    const lines = linesWithReservationSources(
      [
        { tw_Id: 20, tw_StanRez: 0 },
        { tw_Id: 21, tw_StanRez: 6 },
      ],
      sources
    );
    expect(lines[0]!.tw_StanRez).toBe(6);
    expect(reservationSourceTwIds([20], sources).sort()).toEqual([20, 21]);
    const reserved = mergeReservedSlicesBySources(
      new Map([
        [21, [{ quantity: 6, clientKhId: 7, zkNumber: "ZK 5/M/10/2026" }]],
        [20, [{ quantity: 1, clientKhId: 9, zkNumber: "ZK 6/M/10/2026" }]],
      ]),
      [20],
      sources
    );
    expect(reserved.get(20)!.map((x) => x.quantity)).toEqual([2, 6]);
    const maps = individualExtrasAndReliefWithReservationOverlap(
      new Map([
        [
          20,
          {
            extraPieces: 6,
            overlapContributions: [{ orderId: "o1", qty: 6, salesClientKhId: 7, sourceZkNumber: "ZK 5/M/10/2026" }],
          },
        ],
      ]),
      reserved
    );
    expect((maps.stockNeedReliefByTwId.get(20) ?? 0) + (maps.extraOverlapByTwId.get(20) ?? 0)).toBe(6);
  });

  it("zestaw: 5 zestawów zarezerwowanych ZK + prośba tego ZK = 10 szt. składnika, nie 20", () => {
    const boms = [
      {
        parentTwId: 100,
        stockAsCover: true,
        demandAllocation: "explode" as const,
        purchaseTarget: "components" as const,
        components: [{ componentTwId: 1, qtyPerParent: 2 }],
      },
    ];
    const res = buildManualZdEstimateResult(
      { dniZapasu: 30, dniOkresu: 30, zapasMin: 0 },
      [
        { tw_Id: 100, tw_Symbol: "KIT", dostepne: -5, tw_StanRez: 5, sprzedazOkres: 0, celZapasu: 0 },
        { tw_Id: 1, tw_Symbol: "A", dostepne: 0, sprzedazOkres: 0, celZapasu: 0 },
      ],
      { salesTrack: false, productBoms: boms }
    );
    const a = res.pozycje.find((p) => p.tw_Id === 1)!;
    expect(a.doZamowieniaReczne).toBe(10);
    const sources = buildZdOverlapReservationSources({ boms });
    const reserved = mergeReservedSlicesBySources(
      new Map([[100, [{ quantity: 5, clientKhId: 100, zkNumber: "ZK 1" }]]]),
      [1],
      sources
    );
    const maps = individualExtrasAndReliefWithReservationOverlap(
      new Map([[1, { extraPieces: 10, overlapContributions: [{ orderId: "o1", qty: 10, salesClientKhId: 100, sourceZkNumber: "ZK 1" }] }]]),
      reserved
    );
    const qty = resolveOrderQtyForLine(
      a,
      { unitsPerPackage: 1, packageLabel: "szt" },
      maps.extraByTwId.get(1),
      false,
      "sum",
      maps.stockNeedReliefByTwId.get(1) ?? 0,
      maps.extraOverlapByTwId.get(1) ?? 0
    );
    expect(qty.zdUnits).toBe(10);
  });
});
