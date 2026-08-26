import { describe, expect, it } from "vitest";
import { excludeConsumedPendingOrders } from "./zd-estimate-post-create";
import {
  buildIndividualEstimateExtras,
  buildIndividualServiceUwagiBlock,
  collectIndividualOrderIdsForZdCreate,
  composeZdCreateUwagiWithServices,
  countExcludedWithIndividualRequests,
  individualExtraPiecesMap,
  isZdEstimateIndividualEligible,
  mapIndividualOrderToPendingDto,
  matchZdEstimateTwFromOrder,
  reclassifyExcludedTwExtrasToServices,
  reclassifyMissingTwExtrasToServices,
  stripZdCreateUwagiServiceBlock,
  type ZdEstimatePendingIndividualOrder,
} from "./zd-estimate-individual";
import type { IndividualOrder } from "@/types/database";

function pending(
  partial: Partial<ZdEstimatePendingIndividualOrder> & { id: string }
): ZdEstimatePendingIndividualOrder {
  return {
    salesPersonId: "sp1",
    salesPersonName: "Anna",
    products: "Produkt test",
    symbol: null,
    mikranCode: null,
    subiektTwId: null,
    qty: 5,
    requestNote: null,
    salesClientKhId: null,
    sourceZkNumber: null,
    ...partial,
  };
}

function order(partial: Partial<IndividualOrder>): IndividualOrder {
  return {
    id: "o1",
    sales_person_id: "sp1",
    supplier_id: "sup1",
    products: "Produkt",
    symbol: "SYM",
    quantity: "3",
    status: "Nowe",
    request_kind: "zamowienie",
    is_teeth: false,
    ...partial,
  } as IndividualOrder;
}

describe("mapIndividualOrderToPendingDto", () => {
  it("przekazuje sales_client_kh_id i source_zk_number", () => {
    const dto = mapIndividualOrderToPendingDto(
      order({
        sales_client_kh_id: 4242,
        source_zk_number: "ZK 12/M/08/2026",
      })
    );
    expect(dto?.salesClientKhId).toBe(4242);
    expect(dto?.sourceZkNumber).toBe("ZK 12/M/08/2026");
  });
});

describe("overlapContributions w buildIndividualEstimateExtras", () => {
  it("zapisuje wkład z kh_Id do dedupe vs rez. ZK", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "o1",
          symbol: "SYM",
          qty: 1,
          salesClientKhId: 100,
          sourceZkNumber: "ZK 1",
        }),
      ],
      lines: [{ tw_Id: 10, tw_Symbol: "SYM" }],
    });
    const extra = bundle.byTwId.get(10);
    expect(extra?.extraPieces).toBe(1);
    expect(extra?.overlapContributions).toEqual([
      {
        orderId: "o1",
        qty: 1,
        salesClientKhId: 100,
        sourceZkNumber: "ZK 1",
      },
    ]);
  });
});

describe("matchZdEstimateTwFromOrder", () => {
  it("kolejność: symbol > PLU > subiektTwId; bez firstToken", () => {
    const bySymbol = new Map([
      ["ivoclar", 111],
      ["tetric-a2", 222],
    ]);
    const byMikran = new Map([["998877", 222]]);
    const byTw = new Map([
      [111, { tw_Id: 111, tw_Symbol: "IVOCLAR" }],
      [222, { tw_Id: 222, tw_Symbol: "TETRIC-A2" }],
      [999, { tw_Id: 999, tw_Symbol: "STALE" }],
    ]);

    expect(
      matchZdEstimateTwFromOrder(
        pending({
          id: "1",
          symbol: null,
          products: "Ivoclar Tetric",
          mikranCode: "998877",
          subiektTwId: 999,
        }),
        bySymbol,
        byMikran,
        byTw
      )
    ).toBe(222);

    expect(
      matchZdEstimateTwFromOrder(
        pending({
          id: "2",
          symbol: null,
          products: "Ivoclar Tetric",
          mikranCode: null,
          subiektTwId: null,
        }),
        bySymbol,
        byMikran,
        byTw
      )
    ).toBeNull();
  });
});

describe("eligibility", () => {
  it("przyjmuje kompletne zamowienie Nowe", () => {
    expect(isZdEstimateIndividualEligible(order({}))).toBe(true);
    expect(mapIndividualOrderToPendingDto(order({}))?.qty).toBe(3);
  });

  it("odrzuca informację i zęby", () => {
    expect(
      isZdEstimateIndividualEligible(
        order({ request_kind: "informacja", quantity: "-" })
      )
    ).toBe(false);
    expect(isZdEstimateIndividualEligible(order({ is_teeth: true }))).toBe(
      false
    );
  });
});

describe("buildIndividualEstimateExtras", () => {
  it("sumuje extras na tw i piece→pack", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({ id: "a", subiektTwId: 20, qty: 7 }),
        pending({
          id: "b",
          subiektTwId: 20,
          qty: 3,
          salesPersonName: "Bartek",
        }),
      ],
      lines: [
        { tw_Id: 10, tw_Symbol: "PACK" },
        { tw_Id: 20, tw_Symbol: "PIECE" },
      ],
      pairs: [
        {
          packTwId: 10,
          pieceTwId: 20,
          unitsPerPack: 10,
        },
      ],
    });
    expect(bundle.byTwId.has(10)).toBe(true);
    expect(bundle.byTwId.has(20)).toBe(false);
    expect(bundle.byTwId.get(10)?.extraPieces).toBe(10);
    expect(bundle.byTwId.get(10)?.requests).toHaveLength(2);
    expect(individualExtraPiecesMap(bundle).get(10)).toBe(10);
  });

  it("BOM assembled parent → explode prośby na składniki", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 99, qty: 2 })],
      lines: [
        { tw_Id: 99, tw_Symbol: "PROMO" },
        { tw_Id: 1, tw_Symbol: "A" },
        { tw_Id: 2, tw_Symbol: "B" },
      ],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [
            { componentTwId: 1, qtyPerParent: 2 },
            { componentTwId: 2, qtyPerParent: 1 },
          ],
        },
      ],
    });
    expect(bundle.serviceLines).toHaveLength(0);
    expect(bundle.byTwId.get(1)?.extraPieces).toBe(4);
    expect(bundle.byTwId.get(2)?.extraPieces).toBe(2);
    expect(bundle.byTwId.has(99)).toBe(false);
  });

  it("płyn wspólny w 2 zestawach — prośby sumują qty×sztuki", () => {
    // Prośba 3× zestaw A (płyn×1) + prośba 2× zestaw B (płyn×2) → płyn 3+4 = 7
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({ id: "a", subiektTwId: 10, qty: 3 }),
        pending({ id: "b", subiektTwId: 11, qty: 2 }),
      ],
      lines: [
        { tw_Id: 10, tw_Symbol: "ZEST-A" },
        { tw_Id: 11, tw_Symbol: "ZEST-B" },
        { tw_Id: 1, tw_Symbol: "PLYN" },
      ],
      boms: [
        {
          parentTwId: 10,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
        {
          parentTwId: 11,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 1, qtyPerParent: 2 }],
        },
      ],
    });
    expect(bundle.serviceLines).toHaveLength(0);
    expect(bundle.byTwId.has(10)).toBe(false);
    expect(bundle.byTwId.has(11)).toBe(false);
    expect(bundle.byTwId.get(1)?.extraPieces).toBe(7);
    expect(bundle.byTwId.get(1)?.requests).toHaveLength(2);
  });

  it("nested BOM — prośba na zewnętrzny zestaw schodzi na liście ×qty", () => {
    // P×2 → K×1 → A×2  ⇒ A = 2*1*2 = 4
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 3, qty: 2 })],
      lines: [
        { tw_Id: 1, tw_Symbol: "A" },
        { tw_Id: 2, tw_Symbol: "K" },
        { tw_Id: 3, tw_Symbol: "P" },
      ],
      boms: [
        {
          parentTwId: 2,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 1, qtyPerParent: 2 }],
        },
        {
          parentTwId: 3,
          stockAsCover: false,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 2, qtyPerParent: 1 }],
        },
      ],
    });
    expect(bundle.serviceLines).toHaveLength(0);
    expect(bundle.byTwId.has(3)).toBe(false);
    expect(bundle.byTwId.has(2)).toBe(false);
    expect(bundle.byTwId.get(1)?.extraPieces).toBe(4);
  });

  it("purchased kit → rezerwa na K", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 99, qty: 3 })],
      lines: [
        { tw_Id: 99, tw_Symbol: "KIT" },
        { tw_Id: 1, tw_Symbol: "A" },
      ],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: false,
          demandAllocation: "separate",
          purchaseTarget: "as_sold",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
      ],
    });
    expect(bundle.byTwId.get(99)?.extraPieces).toBe(3);
    expect(bundle.serviceLines).toHaveLength(0);
  });

  it("kit_only component → service bom_component_not_purchased", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 1, qty: 2 })],
      lines: [
        { tw_Id: 99, tw_Symbol: "KIT" },
        { tw_Id: 1, tw_Symbol: "A" },
      ],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: false,
          demandAllocation: "separate",
          purchaseTarget: "kit_only",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
      ],
    });
    expect(bundle.byTwId.size).toBe(0);
    expect(bundle.serviceLines[0]?.reason).toBe("bom_component_not_purchased");
  });

  it("kit_from_components: prośby na kolorach → MAX kit-equiv na rodzicu", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({ id: "y1", subiektTwId: 1, qty: 3 }),
        pending({ id: "y2", subiektTwId: 1, qty: 2 }),
        pending({ id: "b1", subiektTwId: 2, qty: 4 }),
      ],
      lines: [
        { tw_Id: 99, tw_Symbol: "MIX" },
        { tw_Id: 1, tw_Symbol: "YELLOW" },
        { tw_Id: 2, tw_Symbol: "BLUE" },
      ],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: false,
          demandAllocation: "separate",
          purchaseTarget: "kit_from_components",
          components: [
            { componentTwId: 1, qtyPerParent: 1 },
            { componentTwId: 2, qtyPerParent: 1 },
          ],
        },
      ],
    });
    // yellow 3+2=5, blue 4 → max=5 na MIX; nie service
    expect(bundle.serviceLines).toHaveLength(0);
    expect(bundle.byTwId.get(1)).toBeUndefined();
    expect(bundle.byTwId.get(2)).toBeUndefined();
    expect(bundle.byTwId.get(99)?.extraPieces).toBe(5);
    expect(bundle.byTwId.get(99)?.requests).toHaveLength(3);
  });

  it("składnik w kit_only i explode → explode wygrywa (rezerwa katalogowa)", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 1, qty: 2 })],
      lines: [
        { tw_Id: 50, tw_Symbol: "PROMO" },
        { tw_Id: 99, tw_Symbol: "KIT" },
        { tw_Id: 1, tw_Symbol: "A" },
      ],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: false,
          demandAllocation: "separate",
          purchaseTarget: "kit_only",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
        {
          parentTwId: 50,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
      ],
    });
    expect(bundle.serviceLines).toHaveLength(0);
    expect(bundle.byTwId.get(1)?.extraPieces).toBe(2);
  });

  it("explode na piece → retarget na pack pary", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 99, qty: 1 })],
      lines: [
        { tw_Id: 99, tw_Symbol: "PROMO" },
        { tw_Id: 10, tw_Symbol: "PACK" },
        { tw_Id: 20, tw_Symbol: "PIECE" },
      ],
      pairs: [
        { packTwId: 10, pieceTwId: 20, unitsPerPack: 10 },
      ],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 20, qtyPerParent: 2 }],
        },
      ],
    });
    expect(bundle.byTwId.has(20)).toBe(false);
    expect(bundle.byTwId.get(10)?.extraPieces).toBe(2);
  });

  it("zęby → service", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "t", subiektTwId: 55, qty: 1 })],
      lines: [{ tw_Id: 55, tw_Symbol: "ZEB" }],
      teethTwIds: [55],
    });
    expect(bundle.serviceLines[0]?.reason).toBe("teeth");
  });

  it("brak tw / match → no_subiekt; symbol match działa", () => {
    const noMatch = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "x",
          subiektTwId: null,
          symbol: null,
          products: "losowy opis bez kodu",
          qty: 1,
        }),
      ],
      lines: [{ tw_Id: 1, tw_Symbol: "AAA" }],
    });
    expect(noMatch.serviceLines[0]?.reason).toBe("no_subiekt");

    const matched = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "y",
          subiektTwId: null,
          symbol: "AAA",
          qty: 4,
        }),
      ],
      lines: [{ tw_Id: 1, tw_Symbol: "AAA" }],
    });
    expect(matched.byTwId.get(1)?.extraPieces).toBe(4);
  });

  it("NIE dokleja prośby po firstToken marki gdy jest poprawny PLU", () => {
    const mikranByTw = new Map<number, string>([
      [111, "111000"],
      [222, "998877"],
    ]);
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "brand-trap",
          subiektTwId: null,
          symbol: null,
          products: "Ivoclar Tetric EvoCeram A2",
          mikranCode: "998877",
          qty: 3,
        }),
      ],
      lines: [
        { tw_Id: 111, tw_Symbol: "IVOCLAR" },
        { tw_Id: 222, tw_Symbol: "TETRIC-A2" },
      ],
      mikranByTw,
    });
    expect(bundle.byTwId.has(111)).toBe(false);
    expect(bundle.byTwId.get(222)?.extraPieces).toBe(3);
  });

  it("NIE używa firstToken marki bez PLU/symbolu — idzie do usług", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "brand-only",
          subiektTwId: null,
          symbol: null,
          mikranCode: null,
          products: "Ivoclar coś tam bez kodu",
          qty: 1,
        }),
      ],
      lines: [{ tw_Id: 111, tw_Symbol: "IVOCLAR" }],
    });
    expect(bundle.byTwId.size).toBe(0);
    expect(bundle.serviceLines[0]?.reason).toBe("no_subiekt");
  });

  it("preferuje jawny symbol nad błędnym subiektTwId", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "stale-tw",
          subiektTwId: 999,
          symbol: "CORRECT",
          mikranCode: null,
          qty: 2,
        }),
      ],
      lines: [
        { tw_Id: 100, tw_Symbol: "CORRECT" },
        { tw_Id: 999, tw_Symbol: "WRONG" },
      ],
    });
    expect(bundle.byTwId.has(999)).toBe(false);
    expect(bundle.byTwId.get(100)?.extraPieces).toBe(2);
  });

  it("preferuje PLU nad błędnym subiektTwId", () => {
    const mikranByTw = new Map<number, string>([
      [100, "PLU-OK"],
      [999, "PLU-BAD"],
    ]);
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "stale-plu",
          subiektTwId: 999,
          symbol: null,
          mikranCode: "PLU-OK",
          qty: 4,
        }),
      ],
      lines: [
        { tw_Id: 100, tw_Symbol: "A" },
        { tw_Id: 999, tw_Symbol: "B" },
      ],
      mikranByTw,
    });
    expect(bundle.byTwId.has(999)).toBe(false);
    expect(bundle.byTwId.get(100)?.extraPieces).toBe(4);
  });

  it("odrzuca subiektTwId sprzeczny z jawnym symbolem linii", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({
          id: "conflict",
          subiektTwId: 999,
          symbol: "WANT-THIS",
          qty: 1,
        }),
      ],
      lines: [{ tw_Id: 999, tw_Symbol: "OTHER-SYM" }],
    });
    // Symbol nie trafia w bySymbol, a storedTw ma inny symbol niż order → null → usługa
    expect(bundle.byTwId.size).toBe(0);
    expect(bundle.serviceLines[0]?.reason).toBe("no_subiekt");
  });

  it("spoza lines → twIdsToFetch", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "z", subiektTwId: 777, qty: 2, symbol: null })],
      lines: [{ tw_Id: 1, tw_Symbol: "IN" }],
    });
    expect(bundle.twIdsToFetch).toEqual([777]);
    expect(bundle.byTwId.get(777)?.extraPieces).toBe(2);
  });
});

describe("collectIndividualOrderIdsForZdCreate", () => {
  it("bierze tylko created tw + opcjonalnie usługi", () => {
    const byTwId = new Map([
      [
        1,
        {
          extraPieces: 2,
          requests: [
            {
              orderId: "o1",
              salesPersonId: "s",
              salesPersonName: "A",
              qty: 2,
              products: "p",
              symbol: null,
              mikranCode: null,
              requestNote: null,
            },
          ],
        },
      ],
      [
        2,
        {
          extraPieces: 1,
          requests: [
            {
              orderId: "o2",
              salesPersonId: "s",
              salesPersonName: "A",
              qty: 1,
              products: "p",
              symbol: null,
              mikranCode: null,
              requestNote: null,
            },
          ],
        },
      ],
    ]);
    const serviceLines = [
      {
        key: "no_subiekt:o3",
        label: "Usługa jednorazowa: x",
        qty: 1,
        reason: "no_subiekt" as const,
        requests: [
          {
            orderId: "o3",
            salesPersonId: "s",
            salesPersonName: "A",
            qty: 1,
            products: "x",
            symbol: null,
            mikranCode: null,
            requestNote: null,
          },
        ],
      },
    ];
    expect(
      collectIndividualOrderIdsForZdCreate({
        byTwId,
        serviceLines,
        createdTwIds: [1],
        includeServiceUwagi: false,
      }).sort()
    ).toEqual(["o1"]);
    expect(
      collectIndividualOrderIdsForZdCreate({
        byTwId,
        createdTwIds: [1],
        serviceOrderIds: ["o3"],
      }).sort()
    ).toEqual(["o1", "o3"]);
    expect(
      collectIndividualOrderIdsForZdCreate({
        byTwId,
        serviceLines,
        createdTwIds: [1],
        includeServiceUwagi: true,
      }).sort()
    ).toEqual(["o1", "o3"]);
  });

  it("nie markuje prośby explode gdy tylko część składowych na ZD", () => {
    const req = {
      orderId: "explode-1",
      salesPersonId: "s",
      salesPersonName: "A",
      qty: 2,
      products: "promo",
      symbol: null,
      mikranCode: null,
      requestNote: null,
    };
    const byTwId = new Map([
      [1, { extraPieces: 4, requests: [req] }],
      [2, { extraPieces: 2, requests: [req] }],
    ]);
    expect(
      collectIndividualOrderIdsForZdCreate({
        byTwId,
        createdTwIds: [1],
      })
    ).toEqual([]);
    expect(
      collectIndividualOrderIdsForZdCreate({
        byTwId,
        createdTwIds: [1, 2],
      })
    ).toEqual(["explode-1"]);
  });

  it("po create, bez Główne, extras zużytych IDs nie doliczają się drugi raz", () => {
    const orders = [
      pending({ id: "a", subiektTwId: 1, qty: 5, symbol: "A" }),
      pending({ id: "b", subiektTwId: 2, qty: 3, symbol: "B" }),
    ];
    const kept = excludeConsumedPendingOrders(orders, ["a"]);
    const bundle = buildIndividualEstimateExtras({
      orders: kept,
      lines: [
        { tw_Id: 1, tw_Symbol: "A" },
        { tw_Id: 2, tw_Symbol: "B" },
      ],
    });
    expect(bundle.byTwId.has(1)).toBe(false);
    expect(bundle.byTwId.get(2)?.extraPieces).toBe(3);
    expect(
      collectIndividualOrderIdsForZdCreate({
        byTwId: bundle.byTwId,
        createdTwIds: [1, 2],
      })
    ).toEqual(["b"]);
  });

  it("bom_explode_incomplete przy pustych składnikach", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [pending({ id: "p", subiektTwId: 99, qty: 1 })],
      lines: [{ tw_Id: 99, tw_Symbol: "PROMO" }],
      boms: [
        {
          parentTwId: 99,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [],
        },
      ],
    });
    expect(bundle.byTwId.size).toBe(0);
    expect(bundle.serviceLines[0]?.reason).toBe("bom_explode_incomplete");
  });

  it("reclassifyMissing: atomowo cała prośba explode → service", () => {
    const req = {
      orderId: "o-exp",
      salesPersonId: "s",
      salesPersonName: "A",
      qty: 2,
      products: "p",
      symbol: "P",
      mikranCode: null,
      requestNote: null,
    };
    const bundle = {
      byTwId: new Map([
        [1, { extraPieces: 4, requests: [req] }],
        [2, { extraPieces: 2, requests: [req] }],
      ]),
      serviceLines: [] as import("./zd-estimate-individual").ZdEstimateIndividualServiceLine[],
      twIdsToFetch: [2],
      meta: {
        orderCount: 1,
        extraPiecesSum: 6,
        serviceCount: 0,
        skippedNoQty: 0,
      },
    };
    const next = reclassifyMissingTwExtrasToServices(bundle, [1]);
    expect(next.byTwId.size).toBe(0);
    expect(next.serviceLines.length).toBe(2);
    expect(next.serviceLines.every((s) => s.reason === "fetch_failed")).toBe(
      true
    );
  });

  it("reclassifyMissing: qty z overlapContributions po explode (nie req.qty)", () => {
    const keepReq = {
      orderId: "o-keep",
      salesPersonId: "s",
      salesPersonName: "A",
      qty: 1,
      products: "p",
      symbol: "K",
      mikranCode: null,
      requestNote: null,
    };
    const goneReq = {
      orderId: "o-gone",
      salesPersonId: "s",
      salesPersonName: "A",
      qty: 1,
      products: "p",
      symbol: "G",
      mikranCode: null,
      requestNote: null,
    };
    const bundle = {
      byTwId: new Map([
        [
          10,
          {
            // 1*3 (keep explode) + 1*3 (gone) — req.qty=1 nie wystarczy do odjęcia
            extraPieces: 6,
            requests: [keepReq, goneReq],
            overlapContributions: [
              {
                orderId: "o-keep",
                qty: 3,
                salesClientKhId: 1,
                sourceZkNumber: null,
              },
              {
                orderId: "o-gone",
                qty: 3,
                salesClientKhId: 2,
                sourceZkNumber: null,
              },
            ],
          },
        ],
        [
          99,
          {
            extraPieces: 3,
            requests: [goneReq],
            overlapContributions: [
              {
                orderId: "o-gone",
                qty: 3,
                salesClientKhId: 2,
                sourceZkNumber: null,
              },
            ],
          },
        ],
      ]),
      serviceLines:
        [] as import("./zd-estimate-individual").ZdEstimateIndividualServiceLine[],
      twIdsToFetch: [99],
      meta: {
        orderCount: 2,
        extraPiecesSum: 9,
        serviceCount: 0,
        skippedNoQty: 0,
      },
    };
    const next = reclassifyMissingTwExtrasToServices(bundle, [10]);
    expect(next.byTwId.get(10)?.extraPieces).toBe(3);
    expect(next.byTwId.get(10)?.overlapContributions).toEqual([
      {
        orderId: "o-keep",
        qty: 3,
        salesClientKhId: 1,
        sourceZkNumber: null,
      },
    ]);
    expect(next.byTwId.has(99)).toBe(false);
  });
});

describe("uwagi usług", () => {
  it("truncate z (+N)", () => {
    const lines = Array.from({ length: 5 }, (_, i) => ({
      key: `k${i}`,
      label: `Usługa jednorazowa: bardzo-dlugi-opis-produktu-${i}`,
      qty: 2,
      reason: "no_subiekt" as const,
      requests: [
        {
          orderId: `o${i}`,
          salesPersonId: "s",
          salesPersonName: "Anna",
          qty: 2,
          products: "p",
          symbol: null,
          mikranCode: null,
          requestNote: null,
        },
      ],
    }));
    const block = buildIndividualServiceUwagiBlock(lines, 80);
    expect(block.text.length).toBeLessThanOrEqual(80);
    expect(block.omittedCount).toBeGreaterThan(0);

    const composed = composeZdCreateUwagiWithServices({
      baseUwagi: "OnTime kreator · Test",
      serviceLines: lines,
      maxLen: 100,
    });
    expect(composed.uwagi.length).toBeLessThanOrEqual(100);
    expect(composed.uwagi.startsWith("OnTime")).toBe(true);
  });

  it("strip + compose nie dubluje bloku Usługi z textarea", () => {
    const lines = [
      {
        key: "s1",
        label: "Usługa jednorazowa: X",
        qty: 1,
        reason: "no_subiekt" as const,
        requests: [
          {
            orderId: "ox",
            salesPersonId: "s",
            salesPersonName: "Anna",
            qty: 1,
            products: "p",
            symbol: "X",
            mikranCode: null,
            requestNote: null,
          },
        ],
      },
    ];
    const once = composeZdCreateUwagiWithServices({
      baseUwagi: "Baza · Usługi: stary tekst",
      serviceLines: lines,
      maxLen: 200,
    });
    expect(once.uwagi.match(/Usługi:/gi)?.length).toBe(1);
    expect(once.uwagi).toContain("Anna");
    expect(stripZdCreateUwagiServiceBlock("A · Usługi: foo")).toBe("A");
  });

  it("prioritizeServices chroni usługi przed długą bazą", () => {
    const lines = [
      {
        key: "s1",
        label: "Usługa jednorazowa: Ważna",
        qty: 2,
        reason: "no_subiekt" as const,
        requests: [
          {
            orderId: "ox",
            salesPersonId: "s",
            salesPersonName: "Anna",
            qty: 2,
            products: "p",
            symbol: "W",
            mikranCode: null,
            requestNote: null,
          },
        ],
      },
    ];
    const maxLen = 200;
    const longBase = "X".repeat(200);
    const without = composeZdCreateUwagiWithServices({
      baseUwagi: longBase,
      serviceLines: lines,
      maxLen,
      prioritizeServices: false,
    });
    expect(without.includedServiceOrderIds).toEqual([]);

    const withPrio = composeZdCreateUwagiWithServices({
      baseUwagi: longBase,
      serviceLines: lines,
      maxLen,
      prioritizeServices: true,
    });
    expect(withPrio.includedServiceOrderIds).toEqual(["ox"]);
    expect(withPrio.uwagi).toContain("Usługi:");
    expect(withPrio.baseTruncated).toBe(true);
    expect(withPrio.uwagi.length).toBeLessThanOrEqual(maxLen);
  });
});

describe("excluded → usługi", () => {
  it("liczy ordery (nie tw) i reclassify do usług", () => {
    const bundle = buildIndividualEstimateExtras({
      orders: [
        pending({ id: "a", subiektTwId: 1, qty: 2 }),
        pending({ id: "b", subiektTwId: 1, qty: 3 }),
        pending({ id: "c", subiektTwId: 2, qty: 1 }),
      ],
      lines: [
        { tw_Id: 1, tw_Symbol: "A" },
        { tw_Id: 2, tw_Symbol: "B" },
      ],
    });
    expect(countExcludedWithIndividualRequests(bundle.byTwId, [1])).toBe(2);
    const routed = reclassifyExcludedTwExtrasToServices(bundle, [1]);
    expect(routed.byTwId.has(1)).toBe(false);
    expect(routed.byTwId.has(2)).toBe(true);
    expect(
      routed.serviceLines.filter((l) => l.reason === "excluded")
    ).toHaveLength(2);
    expect(individualExtraPiecesMap(routed).get(2)).toBe(1);
  });
});
