import { describe, expect, it } from "vitest";
import {
  buildSupplierFormFill,
  findSupplierFormTemplate,
  getSupplierFormTemplate,
  excelSymbolValue,
  matchLinesToCodeRows,
  type SupplierPdfFormTemplate,
} from "@/lib/supplier-forms/templates";

const wiedent = getSupplierFormTemplate("wiedent-wyroby-pomocnicze") as SupplierPdfFormTemplate;

describe("formularz Wiedent", () => {
  it("ZD 42/M/08/2026 daje to samo co ręcznie wypełniony wzór z 10.08", () => {
    const fill = buildSupplierFormFill(
      wiedent,
      [
        { symbol: "160", name: "Wiedent Woskowe kęski zgryzowe 21 szt (opakowanie)", qty: 5 },
        { symbol: "KOLORNIK WIEDENT", name: "Kolornik zębów Wiedent wg W A1-R5", qty: 5 },
        { symbol: "WOSK WIEDENT TWARDY", name: "Wiedent Wosk modelowy 500g twardy", qty: 20 },
      ],
      { day: 10, month: 8, year: 2026 }
    );
    expect(fill.unmapped).toEqual([]);
    expect(fill.values).toEqual({
      "firma lub imię i nazwisko": "Mikran sp. z o.o.",
      adres: "Wojskowa 3/L4 60-072",
      Telefon: "7831008373",
      podpis: "Poznań",
      dn: "10",
      "m-c": "8",
      rok: "6",
      wkz: "5",
      w: "5",
      wmt: "20",
    });
  });

  it("symbol bez różnic w spacjach, suma powtórzeń, nieznane do uwag", () => {
    const fill = buildSupplierFormFill(
      wiedent,
      [
        { symbol: "ESTETIC  ORT 2KG", name: "Estetic Ort proszek 2000 g", qty: 2 },
        { symbol: "estetic ort 2kg", name: "Estetic Ort proszek 2000 g", qty: 1 },
        { symbol: "WIEDENT 6SZT.", name: "Wiedent 6szt.zęby przednie", qty: 3 },
        { symbol: "ESTETIC H", name: "Estetic H zestaw 100g/50ml", qty: 1 },
      ],
      { day: 3, month: 10, year: 2026 }
    );
    expect(fill.values["EO m"]).toBe("3");
    expect(fill.unmapped.map((l) => l.symbol)).toEqual(["WIEDENT 6SZT.", "ESTETIC H"]);
    expect(fill.values["uwagi zamwiającgo"]).toBe(
      "Wiedent 6szt.zęby przednie (WIEDENT 6SZT.) - 3; Estetic H zestaw 100g/50ml (ESTETIC H) - 1"
    );
  });

  it("rozpoznaje dostawcę po nazwie", () => {
    expect(findSupplierFormTemplate("Wiedent")?.id).toBe("wiedent-wyroby-pomocnicze");
    expect(findSupplierFormTemplate("Everall7")).toBeNull();
  });
});

describe("formularz Dentsply Sirona (dopasowanie po kodzie)", () => {
  it("symbol z dopiskiem trafia w kod, suma powtórzeń, brak kodu = poza arkuszem", () => {
    const codeRows = new Map([
      ["C202085", 32],
      ["C400798", 109],
    ]);
    const m = matchLinesToCodeRows(codeRows, [
      { symbol: "C202085 48SZT", name: "Końcówki mieszające Small 48szt", qty: 10 },
      { symbol: "c400798", name: "Zetalabor 5kg + 2x Indurent", qty: 20 },
      { symbol: "C400798", name: "Zetalabor 5kg + 2x Indurent", qty: 4 },
      { symbol: "XYZ-1", name: "Spoza cennika", qty: 2 },
    ]);
    expect([...m.qtyByRow]).toEqual([
      [32, 10],
      [109, 24],
    ]);
    expect(m.unmapped.map((l) => l.symbol)).toEqual(["XYZ-1"]);
  });

  it("rozpoznaje dostawcę", () => {
    expect(findSupplierFormTemplate("Dentsply Sirona (dawny Zhermack)")?.kind).toBe("xlsx");
  });
});

describe("Renfert - własny arkusz", () => {
  it("symbol z cyfr jako liczba, reszta jako tekst (zero na początku zostaje)", () => {
    expect(excelSymbolValue("18600400")).toBe(18600400);
    expect(excelSymbolValue("7661100 100 SZT.")).toBe("7661100 100 SZT.");
    expect(excelSymbolValue("0562520")).toBe("0562520");
  });

  it("rozpoznaje dostawcę „Renfert - EXCEL”", () => {
    expect(findSupplierFormTemplate("Renfert - EXCEL")?.kind).toBe("xlsx-list");
  });
});
