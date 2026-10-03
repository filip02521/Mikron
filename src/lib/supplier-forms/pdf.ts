import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import type { SupplierPdfFormTemplate } from "@/lib/supplier-forms/templates";

const FORMS_DIR = path.join(process.cwd(), "data", "supplier-forms");

/**
 * Wypełnia pola formularza PDF. Czcionka Geist (OFL) — Helvetica formularza
 * nie ma „ń” / „ą”. Pola zostają edytowalne (można poprawić przed wysłaniem).
 */
export async function fillSupplierPdfForm(
  template: SupplierPdfFormTemplate,
  values: Record<string, string>
): Promise<{ bytes: Uint8Array; missingFields: string[] }> {
  const [pdfBytes, fontBytes] = await Promise.all([
    readFile(path.join(FORMS_DIR, template.file)),
    readFile(path.join(FORMS_DIR, "Geist-Regular.ttf")),
  ]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const form = doc.getForm();
  const missingFields: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field) {
      missingFields.push(name);
      continue;
    }
    form.getTextField(name).setText(value);
  }
  form.updateFieldAppearances(font);
  return { bytes: await doc.save(), missingFields };
}
