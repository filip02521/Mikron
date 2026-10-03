import { fillSupplierPdfForm } from "@/lib/supplier-forms/pdf";
import type { PreparedSupplierForm } from "@/lib/supplier-forms/prepare";
import { buildSupplierFormFill, matchLinesToCodeRows, type SupplierFormLine } from "@/lib/supplier-forms/templates";
import { fillSupplierXlsxForm, xlsxTemplateCodeRows } from "@/lib/supplier-forms/xlsx";

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
  const match = matchLinesToCodeRows(await xlsxTemplateCodeRows(p.template), p.lines);
  return { mappedCount: match.mapped.length, unmapped: match.unmapped };
}

export async function renderSupplierForm(
  p: Ready
): Promise<{ bytes: Uint8Array; contentType: string; extension: string }> {
  if (p.template.kind === "pdf") {
    const fill = buildSupplierFormFill(p.template, p.lines, pdfDate(p.date));
    const { bytes } = await fillSupplierPdfForm(p.template, fill.values);
    return { bytes, contentType: "application/pdf", extension: "pdf" };
  }
  // exceljs zapisuje daty w UTC — północ czasu lokalnego dałaby w Excelu dzień wcześniej.
  const excelDate = new Date(Date.UTC(p.date.getFullYear(), p.date.getMonth(), p.date.getDate()));
  const { bytes } = await fillSupplierXlsxForm(p.template, p.lines, { dokNr: p.dokNr, date: excelDate });
  return {
    bytes,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  };
}
