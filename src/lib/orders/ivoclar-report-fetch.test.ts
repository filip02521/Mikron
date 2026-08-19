import { describe, expect, it } from "vitest";
import { extractIvoclarSelloutFromFs, mergeIvoclarFsHeaderIntoDetail } from "./ivoclar-report-fetch";
import type { SubiektDocument } from "@/lib/subiekt/types";

function fsDoc(over: Partial<SubiektDocument> = {}): SubiektDocument {
  return {
    dok_Id: 101,
    dok_NrPelny: "FS 12/2026",
    dok_DataWyst: "2026-08-12T00:00:00",
    dok_OdbiorcaId: 55,
    dok_Pozycja: [],
    kh__Kontrahent_Odbiorca: {
      kh_Id: 55,
      kh_Symbol: "GAB",
      adr_Nazwa: "Gabinet Stomatologiczny",
      adr_Kod: "00-834",
    },
    ...over,
  };
}

describe("extractIvoclarSelloutFromFs", () => {
  it("zostawia tylko linie z cechy Ivoclar", () => {
    const doc = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 2 },
        { ob_TowId: 99, tw_Symbol: "INNY", tw_Nazwa: "Obcy", ob_Ilosc: 8 },
        { ob_TowId: 11, tw_Symbol: "685586 / 100G", tw_Nazwa: "Ivoclar B", ob_Ilosc: 1 },
      ],
    });
    const extracted = extractIvoclarSelloutFromFs(doc, new Set([10, 11]));
    expect(extracted.cancelled).toBe(false);
    expect(extracted.skippedNonIvoclar).toBe(1);
    expect(extracted.rows.map((r) => r.article)).toEqual(["517019", "685586"]);
    expect(extracted.rows[0]?.postalCode).toBe("00-834");
    expect(extracted.rows[0]?.khName).toContain("Gabinet");
  });

  it("pomija anulowaną FS", () => {
    const doc = fsDoc({ dok_StatusNazwa: "Anulowany" } as SubiektDocument);
    const extracted = extractIvoclarSelloutFromFs(doc, new Set([10]));
    expect(extracted.cancelled).toBe(true);
    expect(extracted.rows).toEqual([]);
  });

  it("zostawia ujemną ilość z korekty FS", () => {
    const doc = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: -2 },
      ],
    });
    const extracted = extractIvoclarSelloutFromFs(doc, new Set([10]));
    expect(extracted.rows).toHaveLength(1);
    expect(extracted.rows[0]?.quantity).toBe(-2);
  });

  it("bierze kod pocztowy z nagłówka, gdy szczegół FS go nie ma", () => {
    const header = fsDoc({
      kh__Kontrahent_Odbiorca: {
        kh_Id: 55,
        kh_Symbol: "GAB",
        adr_Nazwa: "Gabinet Stomatologiczny",
        adr_Kod: "00-834",
      },
    });
    const detail = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 1 },
      ],
      kh__Kontrahent_Odbiorca: undefined,
    });
    const merged = mergeIvoclarFsHeaderIntoDetail(header, detail);
    const extracted = extractIvoclarSelloutFromFs(merged, new Set([10]));
    expect(extracted.rows[0]?.postalCode).toBe("00-834");
    expect(extracted.rows[0]?.khName).toContain("Gabinet");
  });

  it("uzupełnia pusty adr_Kod ze szczegółu kodem z nagłówka", () => {
    const header = fsDoc({
      kh__Kontrahent_Odbiorca: {
        kh_Id: 55,
        kh_Symbol: "GAB",
        adr_Nazwa: "Gabinet Stomatologiczny",
        adr_Kod: "00-834",
        adr_Miejscowosc: "Warszawa",
      },
    });
    const detail = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 1 },
      ],
      kh__Kontrahent_Odbiorca: {
        kh_Id: 55,
        kh_Symbol: "GAB",
        adr_Nazwa: "Gabinet Stomatologiczny",
        adr_Kod: "",
        adr_Miejscowosc: "Warszawa",
      },
    });
    const merged = mergeIvoclarFsHeaderIntoDetail(header, detail);
    const extracted = extractIvoclarSelloutFromFs(merged, new Set([10]));
    expect(extracted.rows[0]?.postalCode).toBe("00-834");
  });

  it("dopełnia kod pocztowy z płatnika, gdy odbiorca ma tylko miasto", () => {
    const doc = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 1 },
      ],
      kh__Kontrahent_Odbiorca: {
        kh_Id: 55,
        kh_Symbol: "GAB",
        adr_Nazwa: "Gabinet",
        adr_Kod: "",
        adr_Miejscowosc: "Warszawa",
      },
      kh__Kontrahent_Platnik: {
        kh_Id: 55,
        kh_Symbol: "GAB",
        adr_Nazwa: "Gabinet",
        adr_Kod: "00-834",
        adr_Miejscowosc: "",
      },
    });
    const extracted = extractIvoclarSelloutFromFs(doc, new Set([10]));
    expect(extracted.rows[0]?.postalCode).toBe("00-834");
    expect(extracted.rows[0]?.suggestedCountry).toBe("PL");
  });

  it("liczy linie z ilością 0", () => {
    const doc = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 0 },
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 2 },
      ],
    });
    const extracted = extractIvoclarSelloutFromFs(doc, new Set([10]));
    expect(extracted.skippedZeroQty).toBe(1);
    expect(extracted.rows).toHaveLength(1);
    expect(extracted.rows[0]?.quantity).toBe(2);
  });

  it("bierze linię Ivoclar bez ob_TowId po symbolu z katalogu", () => {
    const doc = fsDoc({
      dok_Pozycja: [
        { tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 1 },
        { ob_TowId: 99, tw_Symbol: "INNY", tw_Nazwa: "Obcy", ob_Ilosc: 3 },
      ],
    });
    const extracted = extractIvoclarSelloutFromFs(doc, {
      twIds: new Set([10]),
      twSymbols: new Set(["517019"]),
      articles: new Set(["517019"]),
    });
    expect(extracted.rows).toHaveLength(1);
    expect(extracted.rows[0]?.article).toBe("517019");
    expect(extracted.skippedNonIvoclar).toBe(1);
  });

  it("nie nadpisuje obcego tw_Id nawet gdy symbol wygląda na Ivoclar", () => {
    const doc = fsDoc({
      dok_Pozycja: [{ ob_TowId: 99, tw_Symbol: "517019", tw_Nazwa: "Obcy", ob_Ilosc: 1 }],
    });
    const extracted = extractIvoclarSelloutFromFs(doc, {
      twIds: new Set([10]),
      twSymbols: new Set(["517019"]),
      articles: new Set(["517019"]),
    });
    expect(extracted.rows).toHaveLength(0);
    expect(extracted.skippedNonIvoclar).toBe(1);
  });

  it("pomija TRIPLEX ZESTAW i PROBASE ZESTAW nawet gdy są w katalogu Ivoclar", () => {
    const doc = fsDoc({
      dok_Pozycja: [
        { ob_TowId: 10, tw_Symbol: "517019", tw_Nazwa: "Ivoclar A", ob_Ilosc: 1 },
        { ob_TowId: 20, tw_Symbol: "TRIPLEX ZESTAW", tw_Nazwa: "Triplex", ob_Ilosc: 2 },
        { ob_TowId: 21, tw_Symbol: "probase zestaw", tw_Nazwa: "Probase", ob_Ilosc: 3 },
      ],
    });
    const extracted = extractIvoclarSelloutFromFs(doc, {
      twIds: new Set([10, 20, 21]),
      twSymbols: new Set(["517019", "TRIPLEX ZESTAW", "PROBASE ZESTAW"]),
      articles: new Set(["517019"]),
    });
    expect(extracted.rows.map((r) => r.twSymbol)).toEqual(["517019"]);
    expect(extracted.skippedExcluded).toBe(2);
    expect(extracted.skippedNonIvoclar).toBe(0);
  });
});
