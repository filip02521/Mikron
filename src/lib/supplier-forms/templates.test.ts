import { describe, expect, it } from "vitest";
import {
  buildSupplierFormFill,
  findSupplierFormTemplate,
  getSupplierFormTemplate,
} from "@/lib/supplier-forms/templates";

const wiedent = getSupplierFormTemplate("wiedent-wyroby-pomocnicze")!;

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
      "Wiedent 6szt.zęby przednie (WIEDENT 6SZT.) — 3; Estetic H zestaw 100g/50ml (ESTETIC H) — 1"
    );
  });

  it("rozpoznaje dostawcę po nazwie", () => {
    expect(findSupplierFormTemplate("Wiedent")?.id).toBe("wiedent-wyroby-pomocnicze");
    expect(findSupplierFormTemplate("Everall7")).toBeNull();
  });
});
