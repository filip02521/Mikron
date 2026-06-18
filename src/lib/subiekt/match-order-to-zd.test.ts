import { describe, expect, it } from "vitest";
import {
  findBestMatchingZdDocument,
  findMatchingZdDocument,
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

  it("dopasowuje kod bazowy gdy symbol ma wariant (H364RNF 103 015)", () => {
    const order = {
      ...baseOrder,
      symbol: "H364RNF 103 015",
      products: "Komet węglik na prostnicę H364RNF 103 015",
    };
    expect(resolveOrderMatchSymbols(order)).toContain("h364rnf");
    expect(
      matchOrderToZdLine(order, { ob_TowId: 1, tw_Symbol: "H364RNF" })
    ).toBe(true);
    expect(
      orderMatchesZdDocument(order, {
        dok_Id: 1,
        dok_Pozycja: [{ ob_TowId: 9, tw_Symbol: "H364RNF" }],
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
});

describe("findBestMatchingZdDocument", () => {
  it("preferuje najwcześniejszy termin realizacji", () => {
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
        [newer, older]
      )?.dok_Id
    ).toBe(1);
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
        [fullOrder, supplement]
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
        [newer, persisted]
      )?.dok_Id
    ).toBe(10);
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
        [persisted, supplement]
      )?.dok_Id
    ).toBe(11);
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
        [doc]
      )?.dok_Id
    ).toBe(2);
  });
});
