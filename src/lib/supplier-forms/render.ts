import { fillSupplierPdfForm } from "@/lib/supplier-forms/pdf";
import type { PreparedSupplierForm } from "@/lib/supplier-forms/prepare";
import { buildSupplierFormFill, matchLinesToCodeRows, type SupplierFormLine } from "@/lib/supplier-forms/templates";
import { buildSupplierXlsxList, fillSupplierXlsxForm, xlsxTemplateCodeRows } from "@/lib/supplier-forms/xlsx";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Ready = Extract<PreparedSupplierForm, { ok: true }>;

function pdfDate(date: Date) {
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

/** Ile pozycji trafi do formularza, a które nie mają w nim miejsca (lista ZD). */
export async function previewSupplierForm(
  p: Ready
): Promise<{ mappedCount: number; unmapped: SupplierFormLine[] }> {
  if (p.template.kind === "pdf") {
    const fill = buildSupplierFormFill(p.template, p.lines, pdfDate(p.date));
    return { mappedCount: fill.mapped.length, unmapped: fill.unmapped };
  }
  if (p.template.kind === "xlsx-list") {
    return { mappedCount: p.lines.filter((l) => l.qty > 0).length, unmapped: [] };
  }
  const match = matchLinesToCodeRows(await xlsxTemplateCodeRows(p.template), p.lines);
  return { mappedCount: match.mapped.length, unmapped: match.unmapped };
}

export async function renderSupplierForm(
  p: Ready
): Promise<{ bytes: Uint8Array; contentType: string; fileName: string }> {
  const base =
    p.template.fileName?.({ dokNr: p.dokNr, date: p.date, supplierName: p.supplierName }) ??
    `${p.supplierName} ${p.dokNr.replace(/[\\/]+/g, "-")}`;
  if (p.template.kind === "pdf") {
    const fill = buildSupplierFormFill(p.template, p.lines, pdfDate(p.date));
    const { bytes } = await fillSupplierPdfForm(p.template, fill.values);
    return { bytes, contentType: "application/pdf", fileName: `${base}.pdf` };
  }
  if (p.template.kind === "xlsx-list") {
    return { bytes: await buildSupplierXlsxList(p.template, p.lines), contentType: XLSX_TYPE, fileName: `${base}.xlsx` };
  }
  // exceljs zapisuje daty w UTC — północ czasu lokalnego dałaby w Excelu dzień wcześniej.
  const excelDate = new Date(Date.UTC(p.date.getFullYear(), p.date.getMonth(), p.date.getDate()));
  const { bytes } = await fillSupplierXlsxForm(p.template, p.lines, { dokNr: p.dokNr, date: excelDate });
  return { bytes, contentType: XLSX_TYPE, fileName: `${base}.xlsx` };
}
