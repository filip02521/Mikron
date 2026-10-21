import { describe, expect, it } from "vitest";
import { extractZdPurchaseLines } from "./price-harvest";
import type { SubiektDocument } from "@/lib/subiekt/types";

describe("extractZdPurchaseLines", () => {
  it("sumuje ilość towaru z kilku pozycji ZD, zostawia wyższą cenę, pomija pozycje bez towaru", () => {
    const doc = {
      dok_Id: 77,
      dok_NrPelny: "ZD 77/M/09/2026",
      dok_DataWyst: "2026-09-03T00:00:00",
      dok_Pozycja: [
        { ob_TowId: 10, ob_Ilosc: 36, ob_CenaNetto: 50 },
        { ob_TowId: 10, ob_Ilosc: 4, ob_CenaNetto: 0 },
        { ob_TowId: 11, ob_Ilosc: 5, ob_CenaNetto: null },
        { ob_TowId: 0, ob_Ilosc: 9, ob_CenaNetto: 1 },
      ],
    } as unknown as SubiektDocument;
    expect(extractZdPurchaseLines(doc, { dokDate: null, khId: 5 })).toEqual([
      { subiektTwId: 10, dokId: 77, dokNr: "ZD 77/M/09/2026", dokDate: "2026-09-03", khId: 5, qty: 40, priceNet: 50 },
      { subiektTwId: 11, dokId: 77, dokNr: "ZD 77/M/09/2026", dokDate: "2026-09-03", khId: 5, qty: 5, priceNet: null },
    ]);
  });
});
