import path from "node:path";
import ExcelJS from "exceljs";
import {
  excelSymbolValue,
  matchLinesToCodeRows,
  normalizeFormSymbol,
  type SupplierFormLine,
  type SupplierXlsxFormTemplate,
  type SupplierXlsxListTemplate,
} from "@/lib/supplier-forms/templates";

const FORMS_DIR = path.join(process.cwd(), "data", "supplier-forms");

async function loadTemplate(template: SupplierXlsxFormTemplate) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(FORMS_DIR, template.file));
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`Pusty szablon ${template.file}.`);
  const codeRows = new Map<string, number>();
  const { firstRow, lastRow, codeColumn } = template.items;
  for (let r = firstRow; r <= lastRow; r += 1) {
    const code = normalizeFormSymbol(String(ws.getCell(`${codeColumn}${r}`).value ?? ""));
    if (code && !codeRows.has(code)) codeRows.set(code, r);
  }
  return { wb, ws, codeRows };
}

/** Kody arkusza raz na proces — podgląd listy ZD bez czytania pliku za każdym razem. */
const codeRowsCache = new Map<string, Promise<Map<string, number>>>();

export function xlsxTemplateCodeRows(template: SupplierXlsxFormTemplate): Promise<Map<string, number>> {
  let cached = codeRowsCache.get(template.id);
  if (!cached) {
    cached = loadTemplate(template).then((t) => t.codeRows);
    cached.catch(() => codeRowsCache.delete(template.id));
    codeRowsCache.set(template.id, cached);
  }
  return cached;
}

/** Arkusz dostawcy z ilościami z ZD i nagłówkiem; formuły przeliczą się przy otwarciu. */
export async function fillSupplierXlsxForm(
  template: SupplierXlsxFormTemplate,
  lines: readonly SupplierFormLine[],
  ctx: { dokNr: string; date: Date }
): Promise<{ bytes: Uint8Array; mapped: ReturnType<typeof matchLinesToCodeRows>["mapped"]; unmapped: SupplierFormLine[] }> {
  const { wb, ws, codeRows } = await loadTemplate(template);
  const { qtyByRow, mapped, unmapped } = matchLinesToCodeRows(codeRows, lines);
  for (const [row, qty] of qtyByRow) ws.getCell(`${template.items.qtyColumn}${row}`).value = qty;
  for (const [address, value] of Object.entries(template.header(ctx))) ws.getCell(address).value = value;
  wb.calcProperties.fullCalcOnLoad = true;
  const buffer = await wb.xlsx.writeBuffer();
  return { bytes: new Uint8Array(buffer as ArrayBuffer), mapped, unmapped };
}

/** Własny arkusz: Lp | Symbol | Nazwa | Ilość — kolejność jak w ZD, żeby faktura wpisywała się 1:1. */
export async function buildSupplierXlsxList(
  template: SupplierXlsxListTemplate,
  lines: readonly SupplierFormLine[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(template.sheetName);
  ws.columns = [
    { header: "Lp", key: "lp", width: template.columns.lp },
    { header: "Symbol", key: "symbol", width: template.columns.symbol },
    { header: "Nazwa", key: "name", width: template.columns.name },
    { header: "Ilość", key: "qty", width: template.columns.qty },
    ...(template.unitColumn
      ? [{ header: template.unitColumn.header, key: "unit", width: template.unitColumn.width }]
      : []),
  ];
  lines.filter((l) => l.qty > 0).forEach((l, i) =>
    ws.addRow({
      lp: i + 1,
      symbol: excelSymbolValue(l.symbol),
      name: l.name,
      qty: l.qty,
      ...(template.unitColumn ? { unit: "szt." } : {}),
    })
  );
  for (const col of ["A", "B", "C"]) ws.getColumn(col).alignment = { horizontal: "left" };
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
