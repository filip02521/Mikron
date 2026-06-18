import { describe, expect, it } from "vitest";
import {
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
  mikran_code: null as string | null,
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

  it("znajduje produkt w najświeższym ZD", () => {
    expect(
      orderMatchesZdDocument(
        { subiekt_tw_id: 200, symbol: "X", mikran_code: null },
        doc
      )
    ).toBe(true);
  });
});

describe("findMatchingZdDocument", () => {
  it("wybiera najświeższy dokument z listy", () => {
    const older: SubiektDocument = {
      dok_Id: 1,
      dok_DataWyst: "2026-05-01",
      dok_Pozycja: [{ ob_TowId: 9, tw_Symbol: "OLD" }],
    };
    const newer: SubiektDocument = {
      dok_Id: 2,
      dok_DataWyst: "2026-06-01",
      dok_Pozycja: [{ ob_TowId: 200, tw_Symbol: "NEW" }],
    };
    expect(
      findMatchingZdDocument(
        { subiekt_tw_id: 200, symbol: "X", mikran_code: null },
        [older, newer]
      )?.dok_Id
    ).toBe(2);
  });
});
