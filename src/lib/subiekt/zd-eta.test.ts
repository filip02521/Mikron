import { describe, expect, it } from "vitest";
import {
  extractZdRealizationDate,
  formatSubiektZdTimingLabel,
  pickZdForOrder,
  zdLineMatchesOrder,
} from "./zd-eta";
import type { SubiektDocument } from "./types";

describe("extractZdRealizationDate", () => {
  it("czyta dok_TerminRealizacji", () => {
    expect(
      extractZdRealizationDate({
        dok_Id: 1,
        dok_TerminRealizacji: "2026-06-15",
      })
    ).toBe("2026-06-15");
  });
});

describe("zdLineMatchesOrder", () => {
  it("dopasowuje symbol", () => {
    expect(zdLineMatchesOrder({ tw_Symbol: "ABC" }, "ABC", "")).toBe("symbol");
  });

  it("dopasowuje nazwę", () => {
    expect(
      zdLineMatchesOrder({ tw_Nazwa: "Wkręt M6 ocynk" }, "-", "wkręt M6")
    ).toBe("name");
  });
});

describe("pickZdForOrder", () => {
  const docs: SubiektDocument[] = [
    {
      dok_Id: 10,
      dok_NrPelny: "ZD 1/2026",
      dok_TerminRealizacji: "2026-06-20",
      dok_DataWyst: "2026-05-10",
      kh__Kontrahent_Platnik: { kh_Id: 1, adr_Nazwa: "Dostawca X" },
      dok_Pozycja: [{ tw_Symbol: "ABC", tw_Nazwa: "Wkręt" }],
    },
  ];

  it("zwraca termin z pasującego ZD", () => {
    const eta = pickZdForOrder(
      {
        id: "o1",
        symbol: "ABC",
        products: "Wkręt",
        status: "Zamowione",
        supplier: { name: "Dostawca X" },
      },
      docs
    );
    expect(eta?.realizationDate).toBe("2026-06-20");
    expect(eta?.documentNumber).toBe("ZD 1/2026");
    expect(eta?.matchedBy).toBe("symbol");
  });
});

describe("formatSubiektZdTimingLabel", () => {
  it("formatuje z numerem ZD", () => {
    const label = formatSubiektZdTimingLabel({
      realizationDate: "2030-06-01",
      documentNumber: "ZD/2",
      matchedBy: "symbol",
    });
    expect(label).toContain("Termin ZD ZD/2");
    expect(label).toContain("01.06.2030");
  });
});
