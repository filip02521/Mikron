import { describe, expect, it } from "vitest";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  linesFromSubiektZd,
  articleCodesText,
  parseArticleCodesPaste,
  parseInvoiceLinesPaste,
  parseLooseNumber,
} from "./customs-lines";

describe("parseLooseNumber", () => {
  it("czyta zapis polski i angielski", () => {
    expect(parseLooseNumber("1 234,50")).toBe(1234.5);
    expect(parseLooseNumber("1,234.50")).toBe(1234.5);
    expect(parseLooseNumber("5.5")).toBe(5.5);
    expect(parseLooseNumber("€ 12,00")).toBe(12);
    expect(parseLooseNumber("")).toBeNull();
  });
});

describe("parseInvoiceLinesPaste", () => {
  it("czyta wiersze z Excela, pomija nagłówek", () => {
    const { lines, errors } = parseInvoiceLinesPaste(
      "Kod\tNazwa\tIlość\tCena\nde-1196\tPlaster knife large\t10\t4,50\n\nDE-1698\tScalpel handle No.3\t20\t2.10\n"
    );
    expect(errors).toEqual([]);
    expect(lines).toEqual([
      { supplierArticleCode: "DE-1196", supplierName: "Plaster knife large", quantity: 10, unitPrice: 4.5, subiektTwId: null },
      { supplierArticleCode: "DE-1698", supplierName: "Scalpel handle No.3", quantity: 20, unitPrice: 2.1, subiektTwId: null },
    ]);
  });

  it("zgłasza wiersz bez ilości poza nagłówkiem", () => {
    const { lines, errors } = parseInvoiceLinesPaste("DE-1\tA\t2\nDE-2;B;;");
    expect(lines).toHaveLength(1);
    expect(errors[0]).toMatch(/Wiersz 2/);
  });
});

describe("linesFromSubiektZd", () => {
  it("bierze symbol dostawcy, gdy jest, inaczej symbol Mikranu", () => {
    const doc = {
      dok_Id: 1,
      dok_Pozycja: [
        { ob_TowId: 11, tw_Symbol: "MIK-1", tw_Nazwa: "Nożyk", ob_Ilosc: 3, ob_CenaNetto: 2, tw_DostSymbol: "de-1196" },
        { ob_TowId: 12, tw_Symbol: "MIK-2", tw_Nazwa: "Łopatka", ob_Ilosc: 1, ob_CenaNetto: null },
      ],
    } as SubiektDocument;
    expect(linesFromSubiektZd(doc)).toEqual([
      { supplierArticleCode: "DE-1196", supplierName: "Nożyk", quantity: 3, unitPrice: 2, subiektTwId: 11 },
      { supplierArticleCode: "MIK-2", supplierName: "Łopatka", quantity: 1, unitPrice: null, subiektTwId: 12 },
    ]);
  });
});

describe("parseArticleCodesPaste", () => {
  it("czyta kody z opisem i listy po przecinku, bez duplikatów", () => {
    expect(
      parseArticleCodesPaste("DE-1411 Mosquito forceps, straight\nde-1412\tMosquito curved\nDE-1332, DE-1333; DE-1411")
    ).toEqual([
      { code: "DE-1411", description: "Mosquito forceps, straight" },
      { code: "DE-1412", description: "Mosquito curved" },
      { code: "DE-1332", description: "" },
      { code: "DE-1333", description: "" },
    ]);
  });

  it("klucz przed tabulatorem może być nazwą (dostawca bez kodów)", () => {
    expect(parseArticleCodesPaste("avera  ML A1 D98-16\tTlenek cyrkonu\nDE-1411\tMosquito")).toEqual([
      { code: "AVERA ML A1 D98-16", description: "Tlenek cyrkonu" },
      { code: "DE-1411", description: "Mosquito" },
    ]);
  });

  it("lista zapisana i otwarta ponownie nie gubi kluczy ze spacjami", () => {
    const codes = ["AVERA ML A1 D98-16", "DE-1411"];
    expect(parseArticleCodesPaste(articleCodesText(codes)).map((a) => a.code)).toEqual(codes);
  });
});
