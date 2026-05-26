import { describe, expect, it } from "vitest";
import {
  extractZdRealizationDate,
  formatSubiektZdTimingLabel,
  isOrderEligibleForZdLookup,
  orderSubiektKhId,
  pickZdForOrder,
  zdDocumentMatchesSupplierKh,
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

  it("dopasowuje po subiekt_tw_id", () => {
    expect(
      zdLineMatchesOrder({ ob_TowId: 2319, tw_Symbol: "X" }, "-", "-", 2319)
    ).toBe("subiekt");
  });
});

describe("zdDocumentMatchesSupplierKh", () => {
  it("dopasowuje po dok_OdbiorcaId", () => {
    expect(zdDocumentMatchesSupplierKh({ dok_Id: 1, dok_OdbiorcaId: 688 }, 688)).toBe(
      true
    );
    expect(zdDocumentMatchesSupplierKh({ dok_Id: 1, dok_OdbiorcaId: 99 }, 688)).toBe(
      false
    );
  });
});

describe("isOrderEligibleForZdLookup", () => {
  it("obejmuje częściowo zrealizowane i zrealizowane z powiązanym dostawcą", () => {
    expect(
      isOrderEligibleForZdLookup({
        id: "1",
        symbol: "ABC",
        products: "Produkt",
        status: "Czesciowo_zrealizowane",
        request_kind: "zamowienie",
        supplier: { name: "Dostawca", subiekt_kh_id: 10 },
      })
    ).toBe(true);
    expect(
      isOrderEligibleForZdLookup({
        id: "2",
        symbol: "ABC",
        products: "Produkt",
        status: "Zrealizowane",
        request_kind: "zamowienie",
        subiekt_kh_id: 10,
      })
    ).toBe(true);
  });

  it("akceptuje subiekt_kh_id jako string z API", () => {
    expect(
      isOrderEligibleForZdLookup({
        id: "s",
        symbol: "ABC",
        products: "Produkt",
        status: "Zamowione",
        request_kind: "zamowienie",
        supplier: { name: "Dostawca", subiekt_kh_id: "688" as unknown as number | null },
      })
    ).toBe(true);
  });

  it("pomija prośby bez powiązania dostawcy z Subiektem", () => {
    expect(
      isOrderEligibleForZdLookup({
        id: "3",
        symbol: "ABC",
        products: "Produkt",
        status: "Zamowione",
        request_kind: "zamowienie",
        supplier: { name: "Dostawca bez linku" },
      })
    ).toBe(false);
    expect(orderSubiektKhId({ id: "x", symbol: "", products: "", status: "", supplier: { name: "X" } })).toBeNull();
  });
});

describe("pickZdForOrder", () => {
  const docs: SubiektDocument[] = [
    {
      dok_Id: 10,
      dok_NrPelny: "ZD 1/2026",
      dok_TerminRealizacji: "2026-06-20",
      dok_DataWyst: "2026-05-10",
      dok_OdbiorcaId: 1,
      kh__Kontrahent_Platnik: { kh_Id: 1, adr_Nazwa: "Dostawca X" },
      dok_Pozycja: [{ tw_Symbol: "ABC", tw_Nazwa: "Wkręt" }],
    },
    {
      dok_Id: 11,
      dok_NrPelny: "ZD 2/2026",
      dok_TerminRealizacji: "2026-07-01",
      dok_OdbiorcaId: 99,
      dok_Pozycja: [{ tw_Symbol: "ABC", tw_Nazwa: "Wkręt" }],
    },
  ];

  it("zwraca termin z pasującego ZD u właściwego kontrahenta", () => {
    const eta = pickZdForOrder(
      {
        id: "o1",
        symbol: "ABC",
        products: "Wkręt",
        status: "Zamowione",
        supplier: { name: "Dostawca X", subiekt_kh_id: 1 },
      },
      docs
    );
    expect(eta?.realizationDate).toBe("2026-06-20");
    expect(eta?.documentNumber).toBe("ZD 1/2026");
    expect(eta?.matchedBy).toBe("symbol");
  });

  it("ignoruje ZD innego dostawcy mimo tej samej pozycji", () => {
    const eta = pickZdForOrder(
      {
        id: "o2",
        symbol: "ABC",
        products: "Wkręt",
        status: "Zamowione",
        supplier: { name: "Dostawca X", subiekt_kh_id: 1 },
      },
      [docs[1]!]
    );
    expect(eta).toBeNull();
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
