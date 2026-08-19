/**
 * xlsx Sellout / Inventory wg procedury Ivoclar.
 * Generowane przez exceljs — ręczny ZIP OOXML Excel na Macu naprawia.
 */

import { Workbook } from "exceljs";
import {
  buildIvoclarInventoryFileRows,
  buildIvoclarSelloutFileRows,
  IVOCLAR_INVENTORY_FILE_COLUMNS,
  IVOCLAR_SELLOUT_FILE_COLUMNS,
  type IvoclarInventoryFileRow,
  type IvoclarInventoryRow,
  type IvoclarSelloutFileRow,
  type IvoclarSelloutRow,
} from "@/lib/orders/ivoclar-report";

type CellValue = string | number;

function withXlsxExtension(filename: string): string {
  return filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
}

function columnWidth(index0: number): number {
  if (index0 === 4) return 24;
  if (index0 === 5) return 22;
  return 14;
}

async function packWorkbook(
  sheetName: string,
  headers: readonly string[],
  data: CellValue[][]
): Promise<Uint8Array> {
  const workbook = new Workbook();
  workbook.creator = "OnTime";
  workbook.lastModifiedBy = "OnTime";
  const created = new Date();
  workbook.created = created;
  workbook.modified = created;
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...headers]);
  for (const row of data) {
    sheet.addRow(row.map((value) => (typeof value === "number" ? value : String(value ?? ""))));
  }
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = columnWidth(i);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export function selloutFileRowValues(row: IvoclarSelloutFileRow): CellValue[] {
  return IVOCLAR_SELLOUT_FILE_COLUMNS.map((key) => row[key]);
}

export function inventoryFileRowValues(row: IvoclarInventoryFileRow): CellValue[] {
  return IVOCLAR_INVENTORY_FILE_COLUMNS.map((key) => row[key]);
}

export type IvoclarXlsxBuild = {
  bytes: Uint8Array;
  filename: string;
  exportedCount: number;
  skippedCount: number;
};

export async function buildIvoclarSelloutXlsx(
  rows: IvoclarSelloutRow[],
  filename: string
): Promise<IvoclarXlsxBuild> {
  const built = buildIvoclarSelloutFileRows(rows);
  const data = built.rows.map(selloutFileRowValues);
  return {
    bytes: await packWorkbook("Sellout", IVOCLAR_SELLOUT_FILE_COLUMNS, data),
    filename: withXlsxExtension(filename),
    exportedCount: built.rows.length,
    skippedCount: built.skippedCount,
  };
}

export async function buildIvoclarInventoryXlsx(
  rows: IvoclarInventoryRow[],
  filename: string
): Promise<IvoclarXlsxBuild> {
  const built = buildIvoclarInventoryFileRows(rows);
  const data = built.rows.map(inventoryFileRowValues);
  return {
    bytes: await packWorkbook("Inventory", IVOCLAR_INVENTORY_FILE_COLUMNS, data),
    filename: withXlsxExtension(filename),
    exportedCount: built.rows.length,
    skippedCount: built.skippedCount,
  };
}

export function ivoclarXlsxToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
