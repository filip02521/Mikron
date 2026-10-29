import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { RolInvoiceView, RolLineView } from "./data";
import { buildRolSheetXlsx, rolFsPdfFileName, rolSheetFileName, rolSheetRows } from "./sheet";

let nextId = 1;
const line = (p: Partial<RolLineView>): RolLineView => ({
  id: nextId++,
  fsDokId: 10,
  twId: 1,
  symbol: "764001",
  ivoclarCatalogNo: "764001",
  name: "Towar 1",
  qtyFs: 1,
  qtyKfs: 0,
  qtyOverride: null,
  excluded: false,
  ...p,
});
const inv = (fsDokId: number, p: Partial<RolInvoiceView> = {}): RolInvoiceView => ({
  fsDokId,
  fsNr: `FS ${fsDokId}/M/09/2026`,
  fsDate: null,
  otherLinesCount: 0,
  kfsDokIds: [],
  excluded: false,
  excludedReason: "",
  pdf: "czeka",
  pdfError: "",
  ...p,
});

describe("pozycje arkusza", () => {
  it("suma po numerze Ivoclar z kilku FS, kolejność FS, bez wyłączonych, ilość ręczna i KFS", () => {
    const rows = rolSheetRows({
      invoices: [inv(10), inv(11), inv(12, { excluded: true })],
      lines: [
        line({ fsDokId: 10, twId: 1, ivoclarCatalogNo: "764318", name: "Zirconia A2", qtyFs: 3 }),
        line({ fsDokId: 10, twId: 2, ivoclarCatalogNo: "764319", name: "Zirconia A3", qtyFs: 2, qtyOverride: 5 }),
        line({ fsDokId: 11, twId: 1, ivoclarCatalogNo: "764318", name: "Zirconia A2", qtyFs: 6, qtyKfs: 1 }),
        line({ fsDokId: 11, twId: 3, ivoclarCatalogNo: "707215", name: "Ivotion", qtyFs: 3, excluded: true }),
        line({ fsDokId: 12, twId: 4, ivoclarCatalogNo: "640500", name: "Liquid", qtyFs: 9 }),
      ],
    });
    expect(rows).toEqual([
      { symbol: "764318", name: "Zirconia A2", qty: 8 },
      { symbol: "764319", name: "Zirconia A3", qty: 5 },
    ]);
  });

  it("plik klienta A nie dostaje pozycji klienta B przy tym samym towarze", () => {
    const a = rolSheetRows({ invoices: [inv(10)], lines: [line({ fsDokId: 10, ivoclarCatalogNo: "764318", qtyFs: 2 })] });
    const b = rolSheetRows({ invoices: [inv(20)], lines: [line({ fsDokId: 20, ivoclarCatalogNo: "764318", qtyFs: 7 })] });
    expect(a).toEqual([{ symbol: "764318", name: "Towar 1", qty: 2 }]);
    expect(b).toEqual([{ symbol: "764318", name: "Towar 1", qty: 7 }]);
  });
});

describe("nazwy plików", () => {
  it("jak w wysłanych mailach", () => {
    expect(rolSheetFileName({ fileLabel: "Przykładowa", discountPct: 25, period: "2026-09-01" })).toBe(
      "ROL Przykładowa -25% September 2026.xlsx"
    );
    expect(rolFsPdfFileName("FS 3417/M/09/2026", "Przykładowa")).toBe("3417 Przykładowa.pdf");
    expect(rolFsPdfFileName("FS 207/M/09/2026", "Wzorcowa")).toBe("207 Wzorcowa.pdf");
  });
});

describe("plik XLSX", () => {
  it("Arkusz1, kolumny Lp | Symbol | Nazwa | Ilość | Jm, bez cen", async () => {
    const buf = await buildRolSheetXlsx([
      { symbol: "764318", name: "Zirconia A2", qty: 8 },
      { symbol: "764319", name: "Zirconia A3", qty: 5 },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Arkusz1"]);
    const ws = wb.getWorksheet("Arkusz1")!;
    const values = (r: number) => (ws.getRow(r).values as unknown[]).slice(1);
    expect(values(1)).toEqual(["Lp", "Symbol", "Nazwa", "Ilość", "Jm"]);
    expect(values(2)).toEqual([1, "764318", "Zirconia A2", 8, "szt."]);
    expect(values(3)).toEqual([2, "764319", "Zirconia A3", 5, "szt."]);
    expect(ws.rowCount).toBe(3);
    expect(ws.getColumn(3).width).toBe(38);
  });
});
