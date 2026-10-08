import type { GmailAttachment } from "@/lib/google/gmail";
import { buildCustomsClearanceWorkbook } from "@/lib/customs/customs-excel";
import type { Db } from "@/lib/customs/customs-data";
import type { CustomsClearanceView } from "@/lib/customs/customs-view";
import { readStorageObject, storageObjectSize } from "@/lib/storage/local";

function invoiceMimeFromName(name: string | null): string {
  const ext = (name ?? "").toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return "application/pdf";
}

export function customsExcelFileName(view: Pick<CustomsClearanceView, "invoiceNumber" | "id">): string {
  const safe = (view.invoiceNumber || view.id.slice(0, 8)).replace(/[^\p{L}\p{N}._-]+/gu, "_");
  return `odprawa_${safe}.xlsx`;
}

/** Załącznik maila do agencji bez treści — `key` stały dla pliku (podgląd nie trafia w inny plik po zmianie listy). */
export type CustomsMailAttachmentRef = {
  key: string;
  filename: string;
  contentType: string;
  size: () => Promise<number>;
  load: () => Promise<Buffer>;
};

/**
 * Załączniki maila do agencji w kolejności wysyłki: faktura, dokumenty podstawy VAT 8%, opcjonalnie Excel.
 * Ta sama lista dla podglądu i wysyłki — w podglądzie widać dokładnie te pliki. Treść czytana dopiero na żądanie.
 */
export async function listCustomsMailAttachments(
  supabase: Db,
  view: CustomsClearanceView,
  includeExcel: boolean
): Promise<CustomsMailAttachmentRef[]> {
  const out: CustomsMailAttachmentRef[] = [];
  const { data: c } = await supabase
    .from("customs_clearances")
    .select("invoice_storage_path, invoice_file_name")
    .eq("id", view.id)
    .single();
  const inv = c as { invoice_storage_path: string | null; invoice_file_name: string | null } | null;
  if (inv?.invoice_storage_path) {
    const path = inv.invoice_storage_path;
    out.push({
      key: "invoice",
      filename: inv.invoice_file_name || "faktura.pdf",
      contentType: invoiceMimeFromName(inv.invoice_file_name),
      size: () => storageObjectSize(path),
      load: () => readStorageObject(path),
    });
  }
  if (view.attachments.length) {
    const { data: docs } = await supabase
      .from("supplier_customs_documents")
      .select("id, storage_path, file_name, mime_type")
      .in("id", view.attachments.map((a) => a.id));
    // Kolejność jak w odprawie, nie jak zwróci baza.
    const byId = new Map(((docs ?? []) as Array<{ id: string; storage_path: string; file_name: string; mime_type: string }>).map((d) => [d.id, d]));
    for (const a of view.attachments) {
      const d = byId.get(a.id);
      if (!d) continue;
      out.push({
        key: `doc-${d.id}`,
        filename: d.file_name,
        contentType: d.mime_type,
        size: () => storageObjectSize(d.storage_path),
        load: () => readStorageObject(d.storage_path),
      });
    }
  }
  if (includeExcel) {
    let workbook: Promise<Buffer> | null = null;
    const build = () => (workbook ??= buildCustomsClearanceWorkbook(view));
    out.push({
      key: "excel",
      filename: customsExcelFileName(view),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: async () => (await build()).length,
      load: build,
    });
  }
  return out;
}

/** Załączniki z treścią — do wysyłki. */
export async function collectCustomsMailAttachments(
  supabase: Db,
  view: CustomsClearanceView,
  includeExcel: boolean
): Promise<Required<GmailAttachment>[]> {
  const refs = await listCustomsMailAttachments(supabase, view, includeExcel);
  const contents = await Promise.all(refs.map((r) => r.load()));
  return refs.map((r, i) => ({ filename: r.filename, content: contents[i]!, contentType: r.contentType }));
}
