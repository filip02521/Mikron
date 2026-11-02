/**
 * Arkusz zamówienia ROL jak wzór z 09.2026 (decyzja P2): jeden arkusz „Arkusz1”, kolumny
 * Lp | Symbol | Nazwa | Ilość | Jm, Symbol = numer Ivoclar, bez cen i bez danych klienta.
 * Pozycje wyłącznie z paczki jednego klienta — plik klienta A nie może dostać pozycji klienta B.
 */
import ExcelJS from "exceljs";
import type { RolInvoiceView, RolLineView } from "./data";
import { rolActiveLines, rolLineQty, rolMonthEn } from "./view";

export type RolSheetRow = { symbol: string; name: string; qty: number };

/** Pozycje do arkusza: aktywne linie zsumowane po numerze Ivoclar, w kolejności pierwszego wystąpienia (FS od najstarszej). */
export function rolSheetRows(batch: { invoices: readonly RolInvoiceView[]; lines: readonly RolLineView[] }): RolSheetRow[] {
  const fsOrder = new Map(batch.invoices.map((i, idx) => [i.fsDokId, idx]));
  const lines = [...rolActiveLines(batch)].sort((a, b) => (fsOrder.get(a.fsDokId) ?? 0) - (fsOrder.get(b.fsDokId) ?? 0) || a.id - b.id);
  const bySymbol = new Map<string, RolSheetRow>();
  for (const l of lines) {
    const symbol = l.ivoclarCatalogNo ?? l.symbol;
    const row = bySymbol.get(symbol);
    if (row) row.qty += rolLineQty(l);
    else bySymbol.set(symbol, { symbol, name: l.name, qty: rolLineQty(l) });
  }
  return [...bySymbol.values()];
}

export function rolSheetFileName(input: { fileLabel: string; discountPct: number; period: string }): string {
  return `ROL ${input.fileLabel} -${input.discountPct}% ${rolMonthEn(input.period)} ${input.period.slice(0, 4)}.xlsx`;
}

/** „FS 3417/M/09/2026” → „3417 <klient>.pdf” (jak w wysłanych mailach). */
export function rolFsPdfFileName(fsNr: string, fileLabel: string): string {
  const nr = fsNr.replace(/^FS\s*/i, "").split("/")[0]?.trim() || fsNr.replace(/[\\/:*?"<>|]/g, "-");
  return `${nr} ${fileLabel}.pdf`;
}

export async function buildRolSheetXlsx(rows: readonly RolSheetRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Arkusz1");
  ws.columns = [
    { header: "Lp", key: "lp", width: 9 },
    { header: "Symbol", key: "symbol", width: 9 },
    { header: "Nazwa", key: "name", width: 38 },
    { header: "Ilość", key: "qty", width: 9 },
    { header: "Jm", key: "jm", width: 7 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r, i) => ws.addRow({ lp: i + 1, symbol: r.symbol, name: r.name, qty: r.qty, jm: "szt." }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
