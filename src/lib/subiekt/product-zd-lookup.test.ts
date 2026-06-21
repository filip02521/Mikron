import { describe, expect, it } from "vitest";
import {
  collectActiveProductZdMatches,
  productToZdLookupOrder,
  rankProductZdLookupMatches,
} from "@/lib/subiekt/product-zd-lookup";
import type { SubiektDocument } from "@/lib/subiekt/types";

function doc(partial: Partial<SubiektDocument> & Pick<SubiektDocument, "dok_Id">): SubiektDocument {
  return {
    dok_NrPelny: "ZD/1/2026",
    dok_DataWyst: "2026-06-01",
    dok_TerminRealizacji: "2026-06-25",
    lines: [],
    dok_Pozycja: [],
    ...partial,
  } as SubiektDocument;
}

describe("product-zd-lookup", () => {
  it("buduje order do dopasowania ZD z produktu Subiekta", () => {
    expect(
      productToZdLookupOrder({
        tw_Id: 42,
        tw_Symbol: "ABC-1",
        tw_Nazwa: "Produkt testowy",
        tw_PLU: "123456",
      })
    ).toMatchObject({
      subiekt_tw_id: 42,
      symbol: "ABC-1",
      products: "Produkt testowy",
      mikran_code: "123456",
    });
  });

  it("zbiera aktywne dopasowania ZD posortowane po terminie", () => {
    const product = {
      tw_Id: 10,
      tw_Symbol: "H364",
      tw_Nazwa: "Freza H364",
    };
    const matches = collectActiveProductZdMatches(
      product,
      [
        doc({
          dok_Id: 2,
          dok_NrPelny: "ZD/B",
          dok_TerminRealizacji: "2099-07-01",
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 5 }],
        }),
        doc({
          dok_Id: 1,
          dok_NrPelny: "ZD/A",
          dok_TerminRealizacji: "2099-06-20",
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 2 }],
        }),
      ],
      { supplierId: "s1", supplierName: "Renfert" },
      [{ id: "s1", name: "Renfert", subiektKhId: 100 }]
    );

    expect(matches.map((match) => match.dokNr)).toEqual(["ZD/A", "ZD/B"]);
    expect(matches[0]?.quantity).toBe(2);
    expect(rankProductZdLookupMatches(matches).map((match) => match.deadline)).toEqual([
      "2099-06-20",
      "2099-07-01",
    ]);
  });
});
