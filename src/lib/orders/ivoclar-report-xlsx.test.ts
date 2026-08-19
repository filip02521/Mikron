import { Workbook } from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildIvoclarInventoryRow,
  buildIvoclarSelloutRow,
  IVOCLAR_INVENTORY_FILE_COLUMNS,
  IVOCLAR_SELLOUT_FILE_COLUMNS,
  ivoclarReportXlsxFilename,
} from "./ivoclar-report";
import { buildIvoclarInventoryXlsx, buildIvoclarSelloutXlsx } from "./ivoclar-report-xlsx";

async function readSheetMatrix(bytes: Uint8Array, sheetName: string): Promise<unknown[][]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  const sheet = workbook.getWorksheet(sheetName);
  expect(sheet).toBeTruthy();
  const colCount = sheet!.columnCount;
  const rows: unknown[][] = [];
  sheet!.eachRow({ includeEmpty: false }, (row) => {
    const values: unknown[] = [];
    for (let i = 1; i <= colCount; i += 1) {
      values.push(row.getCell(i).value);
    }
    rows.push(values);
  });
  return rows;
}

describe("buildIvoclarSelloutXlsx", () => {
  it("zapisuje nagłówki A–F i wiersz danych bez kolumn podglądu", async () => {
    const row = buildIvoclarSelloutRow({
      dokId: 2,
      dokNr: "FS 2/2026",
      dokDataWyst: "2026-08-12",
      khId: 9,
      khName: "Gabinet",
      twId: 11,
      twSymbol: "517019",
      twNazwa: "Zestaw",
      quantity: 2,
      postalRaw: "00-834",
      city: "Warszawa",
    });
    const file = await buildIvoclarSelloutXlsx(
      [row],
      ivoclarReportXlsxFilename("Sellout", "2026-08-16")
    );
    expect(file.filename).toBe("Sellout_202608_ 7036494.xlsx");
    expect(file.exportedCount).toBe(1);
    const matrix = await readSheetMatrix(file.bytes, "Sellout");
    expect(matrix[0]).toEqual([...IVOCLAR_SELLOUT_FILE_COLUMNS]);
    expect(matrix[1]).toEqual(["PL", "517019", 2, "00-834", "yes", ""]);
    const asText = JSON.stringify(matrix);
    expect(asText).not.toContain("FS 2/2026");
    expect(asText).not.toContain("Gabinet");
    expect(asText).not.toContain("Kontrahent");
  });
});

describe("buildIvoclarInventoryXlsx", () => {
  it("zapisuje Article i Balance, bez stanu 0", async () => {
    const keep = buildIvoclarInventoryRow({
      twId: 1,
      twSymbol: "504377",
      twNazwa: "X",
      groupName: "G",
      balance: 7,
      reserved: 0,
      blocked: false,
    });
    const drop = buildIvoclarInventoryRow({
      twId: 2,
      twSymbol: "504378",
      twNazwa: "Y",
      groupName: "G",
      balance: 0,
      reserved: 0,
      blocked: false,
    });
    const file = await buildIvoclarInventoryXlsx([keep, drop], "Inventory_202608_ 7036494");
    expect(file.filename).toBe("Inventory_202608_ 7036494.xlsx");
    expect(file.exportedCount).toBe(1);
    expect(file.skippedCount).toBe(1);
    const matrix = await readSheetMatrix(file.bytes, "Inventory");
    expect(matrix[0]).toEqual([...IVOCLAR_INVENTORY_FILE_COLUMNS]);
    expect(matrix[1]).toEqual(["504377", 7]);
    expect(JSON.stringify(matrix)).not.toContain("504378");
  });
});
