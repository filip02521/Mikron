import { describe, expect, it } from "vitest";
import {
  findBestMatchingZdDocument,
  findMatchingZdDocument,
  isConfidentZdMatchForOrder,
  matchOrderToZdLine,
  orderMatchesZdDocument,
  resolveOrderMatchSymbol,
  resolveOrderMatchSymbols,
} from "./match-order-to-zd";
import type { SubiektDocument } from "./types";

const baseOrder = {
  subiekt_tw_id: null as number | null,
  symbol: "ABC-1",
  products: "Prod",
  quantity: "10",
  delivered_quantity: "-",
  mikran_code: null as string | null,
  zd_fulfillment_dok_id: null as number | null,
};

describe("matchOrderToZdLine", () => {
  it("dopasowuje po tw_Id", () => {
    expect(
      matchOrderToZdLine(
        { ...baseOrder, subiekt_tw_id: 100 },
        { ob_TowId: 100, tw_Symbol: "INNY" }
      )
    ).toBe(true);
  });

  it("dopasowuje po symbolu (case-insensitive)", () => {
    expect(
      matchOrderToZdLine(baseOrder, { ob_TowId: 1, tw_Symbol: "abc-1" })
    ).toBe(true);
  });

  it("dopasowuje po kodzie Mikran", () => {
    expect(
      matchOrderToZdLine(
        { ...baseOrder, symbol: "-", mikran_code: "M-55" },
        { ob_TowId: 2, tw_Symbol: "m-55" }
      )
    ).toBe(true);
  });

  it("nie dopasowuje niepowiązanej pozycji", () => {
    expect(
      matchOrderToZdLine(baseOrder, { ob_TowId: 9, tw_Symbol: "ZZZ" })
    ).toBe(false);
  });

  it("dopasowuje symbol wyciągnięty z nazwy produktu", () => {
    expect(
      resolveOrderMatchSymbol({
        symbol: "-",
        products: "Komet węglik H364RNF",
      })
    ).toBe("h364rnf");
    expect(
      matchOrderToZdLine(
        { ...baseOrder, symbol: "-", products: "Komet węglik H364RNF" },
        { ob_TowId: 1, tw_Symbol: "H364RNF" }
      )
    ).toBe(true);
  });

  it("wymaga pełnego symbolu towaru (H364RNF 103 015)", () => {
    const order = {
      ...baseOrder,
      symbol: "H364RNF 103 015",
      products: "Komet węglik na prostnicę H364RNF 103 015",
      subiekt_tw_id: 16893,
    };
    expect(resolveOrderMatchSymbols(order)).toEqual(["h364rnf 103 015"]);
    expect(
      matchOrderToZdLine(order, { ob_TowId: 16893, tw_Symbol: "H364RNF 103 015" })
    ).toBe(true);
    expect(
      matchOrderToZdLine(order, { ob_TowId: 999, tw_Symbol: "H364RNF" })
    ).toBe(false);
    expect(
      matchOrderToZdLine(order, { ob_TowId: 16739, tw_Symbol: "H364RNF 103 023" })
    ).toBe(false);
    expect(
      orderMatchesZdDocument(order, {
        dok_Id: 1,
        dok_Pozycja: [{ ob_TowId: 16893, tw_Symbol: "H364RNF 103 015" }],
      })
    ).toBe(true);
  });
});

describe("orderMatchesZdDocument", () => {
  const doc: SubiektDocument = {
    dok_Id: 1,
    dok_NrPelny: "ZD/1/2026",
    dok_Pozycja: [
      { ob_TowId: 200, tw_Symbol: "IV-B", tw_Nazwa: "Produkt B" },
    ],
  };

  it("znajduje produkt w dopasowanym ZD", () => {
    expect(
      orderMatchesZdDocument(
        { ...baseOrder, subiekt_tw_id: 200, symbol: "X" },
        doc
      )
    ).toBe(true);
  });

  it("nie dopasowuje po samym PLU=tw_Id gdy linia ma inny towId", () => {
    expect(
      orderMatchesZdDocument(
        {
          subiekt_tw_id: 5412,
          symbol: "KP-213-130-PMK",
          products: "Kleszcze",
          mikran_code: "5412",
        },
        {
          dok_Id: 99,
          dok_Pozycja: [{ ob_TowId: 100, tw_Symbol: "5412", ob_Ilosc: 1 }],
        }
      )
    ).toBe(false);
  });
});

describe("findBestMatchingZdDocument", () => {
  const at = new Date("2026-06-18T12:00:00+02:00");

  it("preferuje najwcześniejszy termin realizacji spośród aktywnych ZD", () => {
    const older: SubiektDocument = {
      dok_Id: 1,
      dok_DataWyst: "2026-05-01",
      dok_TerminRealizacji: "2026-07-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    const newer: SubiektDocument = {
      dok_Id: 2,
      dok_DataWyst: "2026-06-01",
      dok_TerminRealizacji: "2026-09-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    expect(
      findBestMatchingZdDocument(
        { ...baseOrder, subiekt_tw_id: 200 },
        [newer, older],
        { at }
      )?.dok_Id
    ).toBe(1);
  });

  it("pomija ZD z terminem w przeszłości — wybiera aktywny (DFS 606402)", () => {
    const realized: SubiektDocument = {
      dok_Id: 1740290,
      dok_NrPelny: "ZD 78/M/02/2026",
      dok_DataWyst: "2026-02-09",
      dok_TerminRealizacji: "2026-02-27",
      dok_Pozycja: [{ ob_TowId: 7512, tw_Symbol: "606402", ob_Ilosc: 3 }],
    };
    const open: SubiektDocument = {
      dok_Id: 1738323,
      dok_NrPelny: "ZD 36/M/02/2026",
      dok_DataWyst: "2026-02-04",
      dok_TerminRealizacji: "2026-07-15",
      dok_Pozycja: [{ ob_TowId: 7512, tw_Symbol: "606402", ob_Ilosc: 2 }],
    };
    expect(
      findBestMatchingZdDocument(
        {
          ...baseOrder,
          symbol: "606402",
          products: "DIADUR QUATTRO",
          quantity: "3",
          delivered_quantity: "1",
        },
        [realized, open],
        { at }
      )?.dok_NrPelny
    ).toBe("ZD 36/M/02/2026");
  });

  it("pomija ZD ze statusem Zrealizowane (8), nawet z przyszłym terminem", () => {
    const fulfilled: SubiektDocument = {
      dok_Id: 1,
      dok_NrPelny: "ZD/Z",
      dok_Status: 8,
      dok_TerminRealizacji: "2099-01-01",
      dok_Pozycja: [{ ob_TowId: 7512, tw_Symbol: "606402", ob_Ilosc: 3 }],
    };
    const open: SubiektDocument = {
      dok_Id: 2,
      dok_NrPelny: "ZD/O",
      dok_Status: 7,
      dok_TerminRealizacji: "2026-07-15",
      dok_Pozycja: [{ ob_TowId: 7512, tw_Symbol: "606402", ob_Ilosc: 2 }],
    };
    expect(
      findBestMatchingZdDocument(
        { ...baseOrder, symbol: "606402", products: "Prod", quantity: "3" },
        [fulfilled, open],
        { at }
      )?.dok_NrPelny
    ).toBe("ZD/O");
  });

  it("przy częściowej dostawie preferuje ZD z ilością reszty", () => {
    const fullOrder: SubiektDocument = {
      dok_Id: 1,
      dok_DataWyst: "2026-05-01",
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    const supplement: SubiektDocument = {
      dok_Id: 2,
      dok_DataWyst: "2026-06-01",
      dok_TerminRealizacji: "2026-09-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 7 }],
    };
    expect(
      findBestMatchingZdDocument(
        {
          ...baseOrder,
          subiekt_tw_id: 200,
          quantity: "10",
          delivered_quantity: "3",
        },
        [fullOrder, supplement],
        { at }
      )?.dok_Id
    ).toBe(2);
  });

  it("utrzymuje wcześniej zapisany dok_Id gdy nadal pasuje", () => {
    const persisted: SubiektDocument = {
      dok_Id: 10,
      dok_DataWyst: "2026-04-01",
      dok_TerminRealizacji: "2026-10-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    const newer: SubiektDocument = {
      dok_Id: 11,
      dok_DataWyst: "2026-06-01",
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    expect(
      findBestMatchingZdDocument(
        { ...baseOrder, subiekt_tw_id: 200, zd_fulfillment_dok_id: 10 },
        [newer, persisted],
        { at }
      )?.dok_Id
    ).toBe(10);
  });

  it("porzuca zapisany dok_Id gdy termin minął lub ilość nie pokrywa reszty", () => {
    const persistedPast: SubiektDocument = {
      dok_Id: 10,
      dok_DataWyst: "2026-02-01",
      dok_TerminRealizacji: "2026-02-27",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    const supplement: SubiektDocument = {
      dok_Id: 11,
      dok_DataWyst: "2026-06-01",
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 5 }],
    };
    expect(
      findBestMatchingZdDocument(
        {
          ...baseOrder,
          subiekt_tw_id: 200,
          quantity: "10",
          delivered_quantity: "5",
          zd_fulfillment_dok_id: 10,
        },
        [persistedPast, supplement],
        { at }
      )?.dok_Id
    ).toBe(11);
  });

  it("porzuca zapisany dok_Id gdy ilość nie pokrywa reszty", () => {
    const persisted: SubiektDocument = {
      dok_Id: 10,
      dok_DataWyst: "2026-04-01",
      dok_TerminRealizacji: "2026-10-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 3 }],
    };
    const supplement: SubiektDocument = {
      dok_Id: 11,
      dok_DataWyst: "2026-06-01",
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 5 }],
    };
    expect(
      findBestMatchingZdDocument(
        {
          ...baseOrder,
          subiekt_tw_id: 200,
          quantity: "10",
          delivered_quantity: "5",
          zd_fulfillment_dok_id: 10,
        },
        [persisted, supplement],
        { at }
      )?.dok_Id
    ).toBe(11);
  });

  it("przy częściowej dostawie wybiera ZD z brakami zamiast zrealizowanego pełnego", () => {
    const fulfilledFull: SubiektDocument = {
      dok_Id: 31,
      dok_NrPelny: "ZD 31/M/06/2026",
      dok_Status: 8,
      dok_TerminRealizacji: "2026-07-10",
      dok_Pozycja: [{ ob_TowId: 16893, tw_Symbol: "H364RNF 103 015", ob_Ilosc: 5 }],
    };
    const remainder: SubiektDocument = {
      dok_Id: 62,
      dok_NrPelny: "ZD 62/M/06/2026",
      dok_Status: 6,
      dok_DataWyst: "2026-06-15",
      dok_TerminRealizacji: "2026-07-20",
      dok_Pozycja: [{ ob_TowId: 16893, tw_Symbol: "H364RNF 103 015", ob_Ilosc: 3 }],
    };
    expect(
      findBestMatchingZdDocument(
        {
          ...baseOrder,
          subiekt_tw_id: 16893,
          symbol: "H364RNF 103 015",
          quantity: "5",
          delivered_quantity: "2",
          zd_fulfillment_dok_id: 31,
        },
        [fulfilledFull, remainder],
        { at }
      )?.dok_NrPelny
    ).toBe("ZD 62/M/06/2026");
  });
});

describe("isConfidentZdMatchForOrder", () => {
  it("nie ufa luźnemu zapisowi po częściowej dostawie — wymaga dokładnej reszty", () => {
    const doc: SubiektDocument = {
      dok_Id: 10,
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 10 }],
    };
    expect(
      isConfidentZdMatchForOrder(
        {
          ...baseOrder,
          subiekt_tw_id: 200,
          quantity: "10",
          delivered_quantity: "3",
          zd_fulfillment_dok_id: 10,
        },
        doc
      )
    ).toBe(false);
  });

  it("pewne gdy zapisany dok_id ma dokładną resztę ilości", () => {
    const doc: SubiektDocument = {
      dok_Id: 10,
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 7 }],
    };
    expect(
      isConfidentZdMatchForOrder(
        {
          ...baseOrder,
          subiekt_tw_id: 200,
          quantity: "10",
          delivered_quantity: "3",
          zd_fulfillment_dok_id: 10,
        },
        doc
      )
    ).toBe(true);
  });

  it("pewne przy dokładnym pokryciu reszty ilości", () => {
    const doc: SubiektDocument = {
      dok_Id: 2,
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "ABC-1", ob_Ilosc: 7 }],
    };
    expect(
      isConfidentZdMatchForOrder(
        { ...baseOrder, subiekt_tw_id: 200, quantity: "10", delivered_quantity: "3" },
        doc
      )
    ).toBe(true);
  });
});

describe("findMatchingZdDocument", () => {
  it("deleguje do findBestMatchingZdDocument", () => {
    const doc: SubiektDocument = {
      dok_Id: 2,
      dok_DataWyst: "2026-06-01",
      dok_TerminRealizacji: "2026-08-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "NEW" }],
    };
    expect(
      findMatchingZdDocument(
        { ...baseOrder, subiekt_tw_id: 200, symbol: "X" },
        [doc],
        { at: new Date("2026-06-18T12:00:00+02:00") }
      )?.dok_Id
    ).toBe(2);
  });
});
