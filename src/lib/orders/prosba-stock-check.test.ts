import { describe, expect, it } from "vitest";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { SubiektProduct } from "@/lib/subiekt/types";
import {
  adjustStockMapForZkLines,
  applyProsbaLineStockMap,
  assessProsbaLineStock,
  assessProsbaLineStockFromDraft,
  assessProsbaLineZkQuantity,
  buildProsbaSubmitStockConfirm,
  buildProsbaSubmitZkQuantityConfirm,
  buildZkProsbaScopeInitialOrderMarked,
  collectProsbaLineTwIdsMissingStock,
  collectZkProsbaScopeLineTwIds,
  deriveZkProsbaScopeInStockKeys,
  deriveZkProsbaScopeSuggestedOrderKeys,
  filterProsbaLinesWithSufficientStock,
  filterZkProsbaScopeLineKeysNeedingOrder,
  formatProsbaStockLineHint,
  formatProsbaSufficientStockBanner,
  formatZkProsbaAutoMarkedHint,
  formatZkProsbaScopeLineBadge,
  isProsbaLineStockSufficient,
  isProsbaStockAckRequiredError,
  isZkProsbaScopePartialStock,
  prosbaLinesStockSyncSignature,
  stockSnapshotFromSubiektProduct,
  uniqueProsbaLineTwIds,
  zkProsbaScopeAllLinesSufficient,
  zkProsbaScopeLineKeysToOrder,
  zkProsbaScopeLineNeedsOrdering,
  zkProsbaScopeStockFetchFailed,
} from "./prosba-stock-check";

const baseLine: ProductLineDraft = {
  id: "a",
  symbol: "ABC",
  mikranCode: "",
  product: "Wkręt",
  quantity: "5",
};

describe("stockSnapshotFromSubiektProduct", () => {
  it("liczy dostępne jako tw_Stan − tw_StanRez", () => {
    const snap = stockSnapshotFromSubiektProduct({
      tw_Id: 1,
      tw_Stan: 10,
      tw_StanRez: 3,
    } as SubiektProduct);
    expect(snap).toEqual({
      onHand: 10,
      reserved: 3,
      available: 7,
      source: "subiekt",
    });
  });

  it("traktuje brak rezerwacji jako 0", () => {
    const snap = stockSnapshotFromSubiektProduct({
      tw_Id: 1,
      tw_Stan: 4,
    } as SubiektProduct);
    expect(snap?.available).toBe(4);
  });

  it("zwraca null bez tw_Stan", () => {
    expect(stockSnapshotFromSubiektProduct({ tw_Id: 1 } as SubiektProduct)).toBeNull();
  });
});

describe("assessProsbaLineStock", () => {
  const stock = { onHand: 10, reserved: 2, available: 8, source: "subiekt" as const };

  it("sufficient gdy available >= requested", () => {
    expect(assessProsbaLineStock({ requestedQty: 8, stock })).toBe("sufficient");
    expect(assessProsbaLineStock({ requestedQty: 5, stock })).toBe("sufficient");
  });

  it("insufficient przy częściowym stanie — bez ostrzeżenia w UI", () => {
    expect(assessProsbaLineStock({ requestedQty: 9, stock })).toBe("insufficient");
  });

  it("unavailable przy zerowym stanie", () => {
    expect(
      assessProsbaLineStock({
        requestedQty: 2,
        stock: { onHand: 1, reserved: 1, available: 0, source: "subiekt" },
      })
    ).toBe("unavailable");
  });

  it("unknown bez danych magazynowych", () => {
    expect(assessProsbaLineStock({ requestedQty: 1, stock: null })).toBe("unknown");
  });
});

describe("assessProsbaLineStockFromDraft", () => {
  it("ignoruje informację", () => {
    expect(
      assessProsbaLineStockFromDraft(
        { ...baseLine, available: 100, stockSource: "subiekt", onHand: 100, reserved: 0 },
        "informacja"
      )
    ).toBe("unknown");
  });

  it("wykrywa sufficient na linii formularza", () => {
    expect(
      assessProsbaLineStockFromDraft(
        {
          ...baseLine,
          quantity: "5",
          onHand: 10,
          reserved: 0,
          available: 10,
          stockSource: "subiekt",
        },
        "zamowienie"
      )
    ).toBe("sufficient");
  });
});

describe("filterProsbaLinesWithSufficientStock", () => {
  it("zwraca tylko linie z pełnym pokryciem", () => {
    const lines: ProductLineDraft[] = [
      {
        ...baseLine,
        id: "1",
        quantity: "2",
        onHand: 5,
        reserved: 0,
        available: 5,
        stockSource: "subiekt",
      },
      {
        ...baseLine,
        id: "2",
        quantity: "10",
        onHand: 5,
        reserved: 0,
        available: 5,
        stockSource: "subiekt",
      },
    ];
    const filtered = filterProsbaLinesWithSufficientStock(lines, "zamowienie");
    expect(filtered.map((l) => l.id)).toEqual(["1"]);
    expect(isProsbaLineStockSufficient(lines[1]!, "zamowienie")).toBe(false);
  });

  it("pomija produkty z listy zębów", () => {
    const exempt = new Set([42]);
    const lines: ProductLineDraft[] = [
      {
        ...baseLine,
        id: "teeth",
        subiektTwId: 42,
        quantity: "1",
        onHand: 99,
        reserved: 0,
        available: 99,
        stockSource: "subiekt",
      },
    ];
    expect(filterProsbaLinesWithSufficientStock(lines, "zamowienie", exempt)).toEqual([]);
    expect(buildProsbaSubmitStockConfirm(lines, "zamowienie", exempt)).toBeNull();
  });
});

describe("buildProsbaSubmitStockConfirm", () => {
  it("zwraca null bez sufficient lub poza zamówieniem", () => {
    expect(buildProsbaSubmitStockConfirm([], "zamowienie")).toBeNull();
    expect(buildProsbaSubmitStockConfirm([baseLine], "informacja")).toBeNull();
  });

  it("buduje komunikat dla sufficient", () => {
    const result = buildProsbaSubmitStockConfirm(
      [
        {
          ...baseLine,
          quantity: "2",
          onHand: 5,
          reserved: 0,
          available: 5,
          stockSource: "subiekt",
        },
      ],
      "zamowienie"
    );
    expect(result?.sufficientLines).toHaveLength(1);
    expect(result?.message).toContain("Czy na pewno");
  });
});

describe("zkProsbaScopeAllLinesSufficient", () => {
  it("wymaga danych dla każdej linii", () => {
    const lines = [
      { key: "a", subiektTwId: 1, quantity: 2 },
      { key: "b", subiektTwId: 2, quantity: 1 },
    ];
    const stock = {
      1: { onHand: 5, reserved: 0, available: 5, source: "subiekt" as const },
      2: { onHand: 1, reserved: 0, available: 1, source: "subiekt" as const },
    };
    expect(zkProsbaScopeAllLinesSufficient(lines, stock)).toBe(true);
    expect(zkProsbaScopeAllLinesSufficient(lines, {})).toBe(false);
  });
});

describe("formatProsbaSufficientStockBanner", () => {
  it("odmienia pozycja / pozycje / pozycji", () => {
    expect(formatProsbaSufficientStockBanner(1)).toContain("1 pozycja");
    expect(formatProsbaSufficientStockBanner(2)).toContain("2 pozycje");
    expect(formatProsbaSufficientStockBanner(5)).toContain("5 pozycji");
    expect(formatProsbaSufficientStockBanner(22)).toContain("22 pozycje");
  });
});

describe("formatZkProsbaScopeLineBadge", () => {
  it("zaznaczone do zamówienia — etykieta", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: true,
        available: 12,
        hasStockData: true,
      })
    ).toBe("Do zamówienia");
  });

  it("odznaczone na stanie — pokazuje stan", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: false,
        available: 12,
        hasStockData: true,
      })
    ).toBe("Na stanie: 12 szt.");
  });

  it("częściowy stan z zaznaczeniem — pokazuje stan", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: false,
        markedForOrder: true,
        available: 3,
        hasStockData: true,
      })
    ).toBe("Do zamówienia · stan 3 szt.");
  });

  it("częściowy stan bez zaznaczenia — do zamówienia ze stanem", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: false,
        markedForOrder: false,
        available: 3,
        hasStockData: true,
      })
    ).toBe("Do zamówienia · stan 3 szt.");
  });

  it("brak pokrycia stanem bez zaznaczenia — do zamówienia", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: false,
        markedForOrder: false,
        available: 0,
        hasStockData: true,
      })
    ).toBe("Do zamówienia");
  });

  it("odznaczone na stanie z rezerwacją — pokazuje rezerwację", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: false,
        available: 8,
        hasStockData: true,
        onHand: 10,
        reserved: 2,
      })
    ).toBe("Na stanie: 8 szt. (−2 rez.)");
  });

  it("częściowy stan z rezerwacją — pokazuje rezerwację", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: false,
        markedForOrder: true,
        available: 3,
        hasStockData: true,
        onHand: 5,
        reserved: 2,
      })
    ).toBe("Do zamówienia · stan 3 szt. (−2 rez.)");
  });

  it("brak rezerwacji — nie pokazuje sufiksu", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: false,
        available: 10,
        hasStockData: true,
        onHand: 10,
        reserved: 0,
      })
    ).toBe("Na stanie: 10 szt.");
  });

  it("sufficient z rezerwacją z tego ZK — pokazuje breakdown", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: false,
        available: 2,
        hasStockData: true,
        onHand: 2,
        reserved: 0,
        zkLineQty: 2,
        rawReserved: 2,
      })
    ).toBe("Stan 2 · ZK 2 · dost. 2");
  });

  it("sufficient z częściową rezerwacją z ZK i innymi rezerwacjami — pełny breakdown", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: false,
        available: 5,
        hasStockData: true,
        onHand: 7,
        reserved: 2,
        zkLineQty: 3,
        rawReserved: 5,
      })
    ).toBe("Stan 7 · ZK 3 · inne rez. 2 · dost. 5");
  });

  it("sufficient bez rezerwacji z ZK (rawReserved=0) — pokazuje Na stanie", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: false,
        available: 10,
        hasStockData: true,
        onHand: 10,
        reserved: 0,
        zkLineQty: 2,
        rawReserved: 0,
      })
    ).toBe("Na stanie: 10 szt.");
  });

  it("sufficient z rezerwacją z ZK ale zaznaczone do zamówienia — pokazuje Do zamówienia", () => {
    expect(
      formatZkProsbaScopeLineBadge({
        sufficient: true,
        markedForOrder: true,
        available: 2,
        hasStockData: true,
        onHand: 2,
        reserved: 0,
        zkLineQty: 2,
        rawReserved: 2,
      })
    ).toBe("Do zamówienia");
  });
});

describe("zkProsbaScopeLineNeedsOrdering", () => {
  const stock = {
    1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    2: { onHand: 2, reserved: 0, available: 2, source: "subiekt" as const },
  };

  it("odznacza tylko przy pełnym pokryciu", () => {
    expect(
      zkProsbaScopeLineNeedsOrdering(
        { key: "a", subiektTwId: 1, quantity: 10 },
        stock
      )
    ).toBe(false);
    expect(
      zkProsbaScopeLineNeedsOrdering(
        { key: "b", subiektTwId: 2, quantity: 5 },
        stock
      )
    ).toBe(true);
  });

  it("bez tw_Id lub stanu — wymaga zamówienia", () => {
    expect(
      zkProsbaScopeLineNeedsOrdering({ key: "c", subiektTwId: null, quantity: 1 }, stock)
    ).toBe(true);
    expect(
      zkProsbaScopeLineNeedsOrdering({ key: "d", subiektTwId: 99, quantity: 1 }, stock)
    ).toBe(true);
  });
});

describe("buildZkProsbaScopeInitialOrderMarked", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
    { key: "c", subiektTwId: 3, quantity: 1 },
  ];
  const stock = {
    1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    2: { onHand: 2, reserved: 0, available: 2, source: "subiekt" as const },
    3: { onHand: 5, reserved: 0, available: 5, source: "subiekt" as const },
  };

  it("odwzorowuje zapisany zakres", () => {
    expect(
      buildZkProsbaScopeInitialOrderMarked({
        lines,
        stockByTwId: stock,
        existingScope: ["b"],
        needsProsbaByKey: new Map(),
      })
    ).toEqual(["b"]);
  });

  it("łączy explicit needs_prosba z auto-stanem", () => {
    const needs = new Map<string, boolean>([
      ["b", true],
      ["c", false],
    ]);
    expect(
      buildZkProsbaScopeInitialOrderMarked({
        lines,
        stockByTwId: stock,
        existingScope: null,
        needsProsbaByKey: needs,
      })
    ).toEqual(["b"]);
  });
});

describe("formatZkProsbaAutoMarkedHint", () => {
  it("odmienia poprawnie", () => {
    expect(formatZkProsbaAutoMarkedHint(1)).toContain("1 pozycja");
    expect(formatZkProsbaAutoMarkedHint(2)).toContain("2 pozycje wymagają");
    expect(formatZkProsbaAutoMarkedHint(5)).toContain("5 pozycji wymaga");
  });
});

describe("deriveZkProsbaScopeInStockKeys", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
  ];
  const stock = {
    1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    2: { onHand: 2, reserved: 0, available: 2, source: "subiekt" as const },
  };

  it("zwraca tylko linie z pełnym stanem", () => {
    expect(deriveZkProsbaScopeInStockKeys(lines, stock)).toEqual(["a"]);
  });

  it("bez danych magazynowych — nic nie zaznacza", () => {
    expect(deriveZkProsbaScopeInStockKeys(lines, {})).toEqual([]);
  });
});

describe("deriveZkProsbaScopeSuggestedOrderKeys", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
  ];
  const stock = {
    1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    2: { onHand: 2, reserved: 0, available: 2, source: "subiekt" as const },
  };

  it("zwraca tylko linie wymagające zamówienia", () => {
    expect(deriveZkProsbaScopeSuggestedOrderKeys(lines, stock)).toEqual(["b"]);
  });

  it("bez danych magazynowych — nic nie zaznacza", () => {
    expect(deriveZkProsbaScopeSuggestedOrderKeys(lines, {})).toEqual([]);
  });
});

describe("zkProsbaScopeLineKeysToOrder", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
  ];

  it("zwraca tylko pozycje zaznaczone do zamówienia", () => {
    expect(zkProsbaScopeLineKeysToOrder(lines, ["a"])).toEqual(["a"]);
    expect(zkProsbaScopeLineKeysToOrder(lines, [])).toEqual([]);
    expect(zkProsbaScopeLineKeysToOrder(lines, ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("collectZkProsbaScopeLineTwIds", () => {
  it("zbiera unikalne tw_Id > 0", () => {
    expect(
      collectZkProsbaScopeLineTwIds([
        { key: "a", subiektTwId: 1, quantity: 1 },
        { key: "b", subiektTwId: 1, quantity: 2 },
        { key: "c", subiektTwId: null, quantity: 1 },
        { key: "d", subiektTwId: 0, quantity: 1 },
        { key: "e", subiektTwId: 3, quantity: 1 },
      ])
    ).toEqual([1, 3]);
  });
});

describe("zkProsbaScopeStockFetchFailed", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 1 },
  ];
  const stock = {
    1: { onHand: 5, reserved: 0, available: 5, source: "subiekt" as const },
    2: { onHand: 1, reserved: 0, available: 1, source: "subiekt" as const },
  };

  it("false bez towarów do sprawdzenia", () => {
    expect(
      zkProsbaScopeStockFetchFailed(
        [{ key: "x", subiektTwId: null, quantity: 1 }],
        {}
      )
    ).toBe(false);
  });

  it("true przy pustej mapie po fetchu", () => {
    expect(zkProsbaScopeStockFetchFailed(lines, {})).toBe(true);
  });

  it("true gdy brakuje wpisu dla żądanego tw_Id", () => {
    expect(zkProsbaScopeStockFetchFailed(lines, { 1: stock[1]! })).toBe(true);
  });

  it("false gdy wszystkie tw_Id mają wpisy", () => {
    expect(zkProsbaScopeStockFetchFailed(lines, stock)).toBe(false);
  });
});

describe("filterZkProsbaScopeLineKeysNeedingOrder", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
    { key: "c", subiektTwId: 3, quantity: 1 },
  ];
  const stock = {
    1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    2: { onHand: 2, reserved: 0, available: 2, source: "subiekt" as const },
    3: { onHand: 5, reserved: 0, available: 5, source: "subiekt" as const },
  };

  it("pomija klucze z pełnym pokryciem stanem", () => {
    expect(
      filterZkProsbaScopeLineKeysNeedingOrder(lines, ["a", "b", "c"], stock)
    ).toEqual(["b"]);
  });

  it("bez danych magazynowych — zostawia wszystkie klucze", () => {
    expect(
      filterZkProsbaScopeLineKeysNeedingOrder(lines, ["a", "b"], {})
    ).toEqual(["a", "b"]);
  });
});

describe("collectProsbaLineTwIdsMissingStock", () => {
  it("zbiera tw_Id bez stockSource", () => {
    const ids = collectProsbaLineTwIdsMissingStock(
      [
        { ...baseLine, id: "1", subiektTwId: 5 },
        {
          ...baseLine,
          id: "2",
          subiektTwId: 6,
          stockSource: "subiekt",
          available: 1,
          onHand: 1,
        },
      ],
      "zamowienie"
    );
    expect(ids).toEqual([5]);
  });
});

describe("prosbaLinesStockSyncSignature", () => {
  it("łączy tw_Id i ilość", () => {
    expect(
      prosbaLinesStockSyncSignature(
        [{ ...baseLine, subiektTwId: 3, quantity: "4" }],
        "zamowienie"
      )
    ).toBe("3:4");
    expect(prosbaLinesStockSyncSignature([baseLine], "informacja")).toBe("");
  });
});

describe("applyProsbaLineStockMap", () => {
  it("aktualizuje linie tylko gdy stan się zmienił", () => {
    const lines: ProductLineDraft[] = [
      { ...baseLine, id: "1", subiektTwId: 7, quantity: "1" },
    ];
    const stock = {
      7: { onHand: 5, reserved: 0, available: 5, source: "subiekt" as const },
    };
    const first = applyProsbaLineStockMap(lines, stock);
    expect(first.changed).toBe(true);
    expect(first.next[0]?.available).toBe(5);

    const second = applyProsbaLineStockMap(first.next, stock);
    expect(second.changed).toBe(false);
  });
});

describe("isZkProsbaScopePartialStock", () => {
  it("wykrywa częściowy stan", () => {
    expect(
      isZkProsbaScopePartialStock({
        sufficient: false,
        hasStockData: true,
        available: 2,
      })
    ).toBe(true);
    expect(
      isZkProsbaScopePartialStock({
        sufficient: true,
        hasStockData: true,
        available: 10,
      })
    ).toBe(false);
  });
});

describe("uniqueProsbaLineTwIds", () => {
  it("deduplikuje identyfikatory", () => {
    expect(
      uniqueProsbaLineTwIds([
        { ...baseLine, subiektTwId: 1 },
        { ...baseLine, id: "b", subiektTwId: 1 },
        { ...baseLine, id: "c", subiektTwId: 2 },
      ])
    ).toEqual([1, 2]);
  });
});

describe("formatProsbaStockLineHint", () => {
  it("zawiera tytuł, ilość i dostępny stan", () => {
    const hint = formatProsbaStockLineHint({
      product: "Wkręt",
      symbol: "W1",
      quantity: "3",
      available: 10,
    });
    expect(hint).toContain("10 szt.");
    expect(hint).toContain("3 szt.");
    expect(hint).toContain("Wystarczający stan magazynowy");
  });
});

describe("isProsbaStockAckRequiredError", () => {
  it("rozpoznaje komunikat wymagający potwierdzenia", () => {
    expect(
      isProsbaStockAckRequiredError(
        "Część pozycji ma stan.\n\nPotwierdź wysyłkę w formularzu lub odśwież."
      )
    ).toBe(true);
    expect(isProsbaStockAckRequiredError("Inny błąd")).toBe(false);
  });
});

describe("assessProsbaLineZkQuantity", () => {
  const stock = { onHand: 1, reserved: 0, available: 1, source: "subiekt" as const };

  it("partial stock — reszta ze stanu", () => {
    expect(
      assessProsbaLineZkQuantity({
        zkQuantity: 3,
        orderQuantity: 2,
        stock,
      })?.kind
    ).toBe("partial_stock");
  });

  it("under ZK bez stanu — wymaga potwierdzenia", () => {
    expect(
      assessProsbaLineZkQuantity({
        zkQuantity: 3,
        orderQuantity: 2,
        stock: { onHand: 0, reserved: 0, available: 0, source: "subiekt" },
      })?.kind
    ).toBe("under_zk_no_stock");
  });

  it("buildProsbaSubmitZkQuantityConfirm — partial stock", () => {
    const confirm = buildProsbaSubmitZkQuantityConfirm(
      [
        {
          ...baseLine,
          id: "1",
          product: "Implant",
          quantity: "2",
          zkQuantity: 3,
          available: 1,
          onHand: 1,
          stockSource: "subiekt",
        },
      ],
      "zamowienie"
    );
    expect(confirm?.title).toBe("Częściowy stan magazynowy");
    expect(confirm?.message).toContain("Implant");
  });
});

describe("adjustStockMapForZkLines", () => {
  const lines = [
    { key: "a", subiektTwId: 1, quantity: 2 },
    { key: "b", subiektTwId: 2, quantity: 5 },
  ];

  it("odejmuje rezerwację z dodawanego ZK od tw_StanRez", () => {
    const stockByTwId = {
      1: { onHand: 2, reserved: 2, available: 0, source: "subiekt" as const },
      2: { onHand: 10, reserved: 5, available: 5, source: "subiekt" as const },
    };
    const adjusted = adjustStockMapForZkLines(lines, stockByTwId);
    expect(adjusted[1]).toEqual({
      onHand: 2,
      reserved: 0,
      available: 2,
      source: "subiekt",
    });
    expect(adjusted[2]).toEqual({
      onHand: 10,
      reserved: 0,
      available: 10,
      source: "subiekt",
    });
  });

  it("nie daje ujemnych rezerwacji (max 0)", () => {
    const adjusted = adjustStockMapForZkLines(lines, {
      1: { onHand: 2, reserved: 1, available: 1, source: "subiekt" as const },
    });
    expect(adjusted[1]?.reserved).toBe(0);
    expect(adjusted[1]?.available).toBe(2);
  });

  it("zachowuje rezerwacje od innych dokumentów", () => {
    const adjusted = adjustStockMapForZkLines(lines, {
      1: { onHand: 5, reserved: 4, available: 1, source: "subiekt" as const },
    });
    // reserved 4, ZK needs 2 → adjusted reserved = 4 - 2 = 2
    expect(adjusted[1]?.reserved).toBe(2);
    expect(adjusted[1]?.available).toBe(3);
  });

  it("zwraca pusty obiekt gdy brak danych stanu", () => {
    const adjusted = adjustStockMapForZkLines(lines, {});
    expect(adjusted).toEqual({});
  });

  it("sumuje ilości gdy ten sam tw_Id w wielu liniach", () => {
    const multiLines = [
      { key: "a", subiektTwId: 1, quantity: 2 },
      { key: "b", subiektTwId: 1, quantity: 3 },
    ];
    const adjusted = adjustStockMapForZkLines(multiLines, {
      1: { onHand: 10, reserved: 5, available: 5, source: "subiekt" as const },
    });
    // total qty = 5, reserved 5 → adjusted reserved = 0
    expect(adjusted[1]?.reserved).toBe(0);
    expect(adjusted[1]?.available).toBe(10);
  });

  it("pomija linie bez tw_Id lub z zerową ilością", () => {
    const weirdLines = [
      { key: "a", subiektTwId: null, quantity: 2 },
      { key: "b", subiektTwId: 1, quantity: 0 },
      { key: "c", subiektTwId: 2, quantity: 3 },
    ];
    const adjusted = adjustStockMapForZkLines(weirdLines, {
      2: { onHand: 5, reserved: 3, available: 2, source: "subiekt" as const },
    });
    expect(adjusted[2]?.reserved).toBe(0);
    expect(adjusted[2]?.available).toBe(5);
    expect(adjusted[1]).toBeUndefined();
  });
});
