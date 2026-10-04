import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  decodeCsvBytes,
  detectInvoiceColumns,
  parseInvoiceWorkbook,
  parseQuantity,
  readSpreadsheetSheets,
  splitCodeFromName,
  isLegacyXls,
  isSpreadsheetFile,
  parseArticleCodesSheet,
  parseCsv,
  parseInvoiceSheet,
  readSpreadsheetRows,
} from "./customs-spreadsheet";

describe("detectInvoiceColumns / parseInvoiceSheet", () => {
  it("czyta fakturę z nagłówkiem po kilku wierszach metryki i kończy na sumie", () => {
    const rows = [
      ["Aswad Instruments", null, null, null],
      ["Invoice AI/3177/26", null, null, "20.04.2026"],
      [],
      ["Item No.", "Description", "Qty", "Unit Price", "Amount"],
      ["de-1196", "Plaster knife large", 10, "4,50", 45],
      ["DE-1698", "Scalpel handle No.3", "20", 2.1, 42],
      ["", "", "", "", ""],
      ["Total", "", 30, "", 87],
    ];
    expect(detectInvoiceColumns(rows)).toEqual({ header: 3, code: 0, name: 1, qty: 2, price: 3 });
    expect(parseInvoiceSheet(rows)).toMatchObject({
      skipped: 0,
      headers: { code: "Item No.", name: "Description", qty: "Qty", price: "Unit Price" },
      lines: [
        { supplierArticleCode: "DE-1196", supplierName: "Plaster knife large", quantity: 10, unitPrice: 4.5, subiektTwId: null },
        { supplierArticleCode: "DE-1698", supplierName: "Scalpel handle No.3", quantity: 20, unitPrice: 2.1, subiektTwId: null },
      ],
    });
  });

  it("rozpoznaje polskie i niemieckie nagłówki", () => {
    expect(detectInvoiceColumns([["Lp.", "Nr katalogowy", "Nazwa towaru", "Ilość", "Cena netto"]])).toMatchObject({
      code: 1,
      name: 2,
      qty: 3,
      price: 4,
    });
    expect(detectInvoiceColumns([["Artikel-Nr.", "Bezeichnung", "Menge", "Einzelpreis"]])).toMatchObject({
      code: 0,
      name: 1,
      qty: 2,
      price: 3,
    });
  });

  it("pomija wiersze bez ilości, zwraca null bez nagłówka", () => {
    const parsed = parseInvoiceSheet([["Code", "Qty"], ["DE-1", 5], ["note: free goods", ""], ["DE-2", "2"]]);
    expect(parsed?.lines.map((l) => l.supplierArticleCode)).toEqual(["DE-1", "DE-2"]);
    expect(parsed?.skipped).toBe(1);
    expect(parseInvoiceSheet([["a", "b"], ["c", "d"]])).toBeNull();
  });
});

describe("parseArticleCodesSheet", () => {
  it("bierze kolumnę z nagłówka kodu i opis", () => {
    expect(
      parseArticleCodesSheet([
        ["Annex A"],
        ["Ref", "Description"],
        ["de-1411", "Mosquito forceps straight"],
        ["DE-1412", "Mosquito forceps curved"],
        ["DE-1411", "dup"],
      ])
    ).toEqual([
      { code: "DE-1411", description: "Mosquito forceps straight" },
      { code: "DE-1412", description: "Mosquito forceps curved" },
    ]);
  });

  it("bez nagłówka wybiera kolumnę z największą liczbą kodów", () => {
    expect(
      parseArticleCodesSheet([
        ["Lp", "Produkt", "Kod?"],
        [1, "Mosquito", "DE-1411"],
        [2, "Iris", "DE-1332"],
      ]).map((a) => a.code)
    ).toEqual(["DE-1411", "DE-1332"]);
  });
});

describe("parseCsv", () => {
  it("wykrywa średnik i obsługuje cudzysłowy", () => {
    expect(parseCsv('Kod;Nazwa;Ilość\nDE-1;"Nożyk; duży ""A""";5\r\nDE-2;Łopatka;2')).toEqual([
      ["Kod", "Nazwa", "Ilość"],
      ["DE-1", 'Nożyk; duży "A"', "5"],
      ["DE-2", "Łopatka", "2"],
    ]);
  });
});

describe("readSpreadsheetRows", () => {
  it("czyta xlsx (formuły jako wynik, daty jako ISO)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Faktura");
    ws.addRow(["Item no", "Name", "Qty", "Price", "Amount"]);
    ws.addRow(["DE-1196", "Knife", 10, 4.5, { formula: "C2*D2", result: 45 }]);
    ws.addRow(["Date", new Date("2026-04-20T00:00:00Z")]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const rows = await readSpreadsheetRows(buf, "faktura.xlsx");
    expect(rows[1]).toEqual(["DE-1196", "Knife", 10, 4.5, 45]);
    expect(rows[2]).toEqual(["Date", "2026-04-20"]);
  });

  it("rozpoznaje typy plików", () => {
    expect(isSpreadsheetFile("a.xlsx", "")).toBe(true);
    expect(isSpreadsheetFile("a.csv", "text/csv")).toBe(true);
    expect(isSpreadsheetFile("a.pdf", "application/pdf")).toBe(false);
    expect(isLegacyXls("a.xls", "")).toBe(true);
    expect(isSpreadsheetFile("a.xls", "application/vnd.ms-excel")).toBe(true);
  });
});

describe("stary Excel .xls (BIFF) i grupy w scalonych komórkach", () => {
  // Układ packing listy Upcera: DESCRIPTION tylko w pierwszym wierszu grupy, model w P/N.
  const upceraRows = [
    ["PACKING LIST"],
    ["DESCRIPTION", "PACKING NO.", "Lot Number", "P/N", "QTY(PCS)", "N.W.  (KG)"],
    ["Dental Zirconia Ceramic", 1, "L2260730006-159", "GT(F)P1-M-B1 D98-25", 14, 7.98],
    [null, null, "L2260730006-135", "GT(F)P1-M-A1 D98-25", 15, 8.55],
    [null, 2, "L2260730006-284", "S-B1 D98-12", 2, 0.58],
    ["Dental Lithium Disilicate Glass Ceramic", 3, "L1", "LT VBL2-R(18-15-13)", 100, 3.1],
    [null, null, "L2", "HT VA1-R(18-15-13)", 50, 1.6],
    ["TOTAL:", "ONLY 3 CARTONS", null, null, 181, 21.8],
  ];

  it("czyta .xls i rozpoznaje P/N jako kod, a DESCRIPTION jako grupę przenoszoną w dół", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(upceraRows), "PL");
    const bytes = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xls" }) as Buffer);
    const parsed = parseInvoiceWorkbook(await readSpreadsheetSheets(bytes, "PACKING LIST-upc260650-1.xls"));
    expect(parsed?.headers.code).toBe("P/N");
    expect(parsed?.lines.map((l) => [l.supplierArticleCode, l.supplierName, l.quantity, l.invoiceGroup])).toEqual([
      ["GT(F)P1-M-B1 D98-25", "GT(F)P1-M-B1 D98-25", 14, "Dental Zirconia Ceramic"],
      ["GT(F)P1-M-A1 D98-25", "GT(F)P1-M-A1 D98-25", 15, "Dental Zirconia Ceramic"],
      ["S-B1 D98-12", "S-B1 D98-12", 2, "Dental Zirconia Ceramic"],
      ["LT VBL2-R(18-15-13)", "LT VBL2-R(18-15-13)", 100, "Dental Lithium Disilicate Glass Ceramic"],
      ["HT VA1-R(18-15-13)", "HT VA1-R(18-15-13)", 50, "Dental Lithium Disilicate Glass Ceramic"],
    ]);
  });

  it("zwykła tabela (nazwa w każdym wierszu) — bez grupy", () => {
    const parsed = parseInvoiceSheet([
      ["Code", "Description", "Qty", "Price"],
      ["DE-1196", "Plaster Knife", 10, 4.5],
      ["DE-1698", "Scalpel Handle # 3", 20, 2.1],
      ["DE-1412", "Mosquito Forcep curved", 5, 3],
      ["DE-1189", "Lessmann Fig 2", 5, 3],
    ]);
    expect(parsed?.lines.every((l) => l.invoiceGroup === undefined)).toBe(true);
    expect(parsed?.lines[0]?.supplierName).toBe("Plaster Knife");
  });
});

describe("różne układy faktur", () => {
  it("chiński proforma: SKU / Goods Description / Quantity(PCS) / Unit Price(USD) / Amount", () => {
    const parsed = parseInvoiceSheet([
      ["COMMERCIAL INVOICE"],
      ["No.", "SKU", "Goods Description", "HS Code", "Quantity(PCS)", "Unit Price(USD)", "Amount(USD)"],
      [1, "AC-PLA-01", "PLA filament white 1kg", "3916909000", "200", "$6.20", "$1,240.00"],
      [2, "AC-RES-02", "UV resin 1L", "3907300000", "1,000", "$9.10", "$9,100.00"],
      ["", "", "TOTAL", "", 1200, "", 10340],
    ]);
    expect(parsed?.headers).toEqual({ code: "SKU", name: "Goods Description", qty: "Quantity(PCS)", price: "Unit Price(USD)" });
    expect(parsed?.lines.map((l) => [l.supplierArticleCode, l.quantity, l.unitPrice])).toEqual([
      ["AC-PLA-01", 200, 6.2],
      ["AC-RES-02", 1000, 9.1],
    ]);
  });

  it("niemiecka faktura: Pos / Artikel-Nr. / Artikelbezeichnung / Menge / Einzelpreis / Gesamtpreis", () => {
    const parsed = parseInvoiceSheet([
      ["Pos.", "Artikel-Nr.", "Artikelbezeichnung", "Menge", "Einheit", "Einzelpreis", "Gesamtpreis"],
      [1, "4711-03", "Gipsmesser groß", "1.000", "Stk", "1,25", "1.250,00"],
      [2, "4712", "Wachsmesser", 12, "Stk", "3,40", "40,80"],
      ["", "", "Summe", "", "", "", "1.290,80"],
    ]);
    expect(parsed?.columns).toMatchObject({ code: 1, name: 2, qty: 3, price: 5 });
    expect(parsed?.lines.map((l) => [l.supplierArticleCode, l.quantity, l.unitPrice])).toEqual([
      ["4711-03", 1000, 1.25],
      ["4712", 12, 3.4],
    ]);
  });

  it("nagłówek w dwóch wierszach i brak osobnej kolumny kodu (kod w nazwie)", () => {
    const parsed = parseInvoiceSheet([
      ["Item", "", "Unit", "Total"],
      ["Description", "Qty", "Price", "Amount"],
      ["DE-1196 Plaster knife large", "10 pcs", "4.50", "45.00"],
      ["Scalpel handle No.3", "20", "2.10", "42.00"],
    ]);
    expect(parsed?.lines.map((l) => [l.supplierArticleCode, l.supplierName, l.quantity, l.unitPrice])).toEqual([
      ["DE-1196", "Plaster knife large", 10, 4.5],
      ["", "Scalpel handle No.3", 20, 2.1],
    ]);
  });

  it("polska faktura z kolumną ilości opakowań nie myli ilości", () => {
    const parsed = parseInvoiceSheet([
      ["Lp.", "Indeks", "Nazwa towaru", "Ilość kartonów", "Ilość szt.", "Cena jedn. netto", "Wartość netto"],
      [1, "MK-100", "Łopatka", 2, 40, "3,10", "124,00"],
    ]);
    expect(parsed?.columns).toMatchObject({ code: 1, name: 2, qty: 4, price: 5 });
    expect(parsed?.lines[0]).toMatchObject({ supplierArticleCode: "MK-100", quantity: 40, unitPrice: 3.1 });
  });

  it("kod HS / EAN nie jest brany jako kod artykułu", () => {
    const cols = detectInvoiceColumns([["EAN", "HS code", "Item code", "Name", "Qty"]]);
    expect(cols).toMatchObject({ code: 2, name: 3, qty: 4 });
  });

  it("skoroszyt: wybiera arkusz z pozycjami, nie okładkę", () => {
    const cover = [["Proforma"], ["Buyer", "Mikran"]];
    const items = [["Code", "Name", "Qty"], ["X-1", "A", 1], ["X-2", "B", 2]];
    expect(parseInvoiceWorkbook([cover, items])?.lines).toHaveLength(2);
    expect(parseInvoiceWorkbook([cover])).toBeNull();
  });
});

describe("parseQuantity / splitCodeFromName / decodeCsvBytes", () => {
  it("ilości w różnych zapisach", () => {
    expect(parseQuantity("10 pcs")).toBe(10);
    expect(parseQuantity("1.000")).toBe(1000);
    expect(parseQuantity("1 000")).toBe(1000);
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity(7)).toBe(7);
    expect(parseQuantity("")).toBeNull();
  });

  it("kod na początku nazwy", () => {
    expect(splitCodeFromName("DE-1196 Plaster knife")).toEqual({ code: "DE-1196", name: "Plaster knife" });
    expect(splitCodeFromName("4711-03 – Gipsmesser")).toEqual({ code: "4711-03", name: "Gipsmesser" });
    expect(splitCodeFromName("Scalpel handle No.3")).toEqual({ code: "", name: "Scalpel handle No.3" });
  });

  it("CSV w Windows-1250", () => {
    const cp1250 = Buffer.from([0x4b, 0x6f, 0x64, 0x3b, 0xa3, 0x6f, 0x70, 0x61, 0x74, 0x6b, 0x61]); // "Kod;Łopatka"
    expect(decodeCsvBytes(cp1250)).toBe("Kod;Łopatka");
    expect(decodeCsvBytes(Buffer.from("\uFEFFKod;Nożyk", "utf8"))).toBe("Kod;Nożyk");
  });

  it("czyta wszystkie arkusze xlsx", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Okładka").addRow(["Proforma"]);
    const ws = wb.addWorksheet("Items");
    ws.addRow(["Code", "Name", "Qty"]);
    ws.addRow(["X-1", "A", 3]);
    ws.addRow(["X-2", "B", 4]);
    const sheets = await readSpreadsheetSheets(Buffer.from(await wb.xlsx.writeBuffer()), "x.xlsx");
    expect(sheets).toHaveLength(2);
    expect(parseInvoiceWorkbook(sheets)?.lines).toHaveLength(2);
  });
});
