// @service-role-ok — wywoływane z trasy plików po sprawdzeniu roli admin/zakupy (i w plasterku 5 z wysyłki).
/**
 * Pliki zgłoszenia jednego klienta: arkusz zamówienia + PDF-y jego FS z pozycjami do zgłoszenia.
 * Wszystko z jednej paczki — tę samą funkcję użyje wysyłka (plasterek 5), więc mail dostanie te same pliki.
 */
import JSZip from "jszip";
import { loadRolBatchById } from "./data";
import { loadRolPdfBytes } from "./pdfs";
import { buildRolSheetXlsx, rolFsPdfFileName, rolSheetFileName, rolSheetRows } from "./sheet";
import { rolActiveLines, rolMonthEn } from "./view";

export type RolFile = { name: string; contentType: string; content: Buffer };

export type RolBatchFiles = {
  label: string;
  sheet: RolFile;
  pdfs: RolFile[];
  /** FS bez PDF — wysyłka i ZIP czekają, aż się pobiorą. */
  missingPdf: string[];
};

export async function buildRolBatchFiles(batchId: string): Promise<RolBatchFiles | null> {
  const found = await loadRolBatchById(batchId);
  if (!found) return null;
  const { batch, program } = found;
  const rows = rolSheetRows(batch);
  const sheet: RolFile = {
    name: rolSheetFileName({ fileLabel: program.fileLabel, discountPct: program.discountPct, period: batch.period }),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: await buildRolSheetXlsx(rows),
  };
  // PDF tylko FS, z których coś idzie do zgłoszenia.
  const activeFs = new Set(rolActiveLines(batch).map((l) => l.fsDokId));
  const invoices = batch.invoices.filter((i) => activeFs.has(i.fsDokId));
  const bytes = await loadRolPdfBytes(invoices.map((i) => i.fsDokId));
  const pdfs: RolFile[] = [];
  const missingPdf: string[] = [];
  for (const inv of invoices) {
    const content = bytes.get(inv.fsDokId);
    if (content) pdfs.push({ name: rolFsPdfFileName(inv.fsNr, program.fileLabel), contentType: "application/pdf", content });
    else missingPdf.push(inv.fsNr);
  }
  return { label: `ROL ${program.fileLabel} ${rolMonthEn(batch.period)} ${batch.period.slice(0, 4)}`, sheet, pdfs, missingPdf };
}

export async function zipRolBatchFiles(files: RolBatchFiles): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of [files.sheet, ...files.pdfs]) zip.file(f.name, f.content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
