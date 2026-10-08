/**
 * Pliki dokładane ręcznie do maila (np. ZD do dostawcy): inne zamówienia w PDF/Excelu, zdjęcia.
 * Te same reguły w przeglądarce (komunikat od razu) i w akcji serwera (granica zaufania).
 */

export const EXTRA_ATTACHMENTS_MAX_FILES = 10;
/** Gmail przyjmuje 25 MB po zakodowaniu base64 (+33%); zostaje miejsce na wydruk ZD. */
export const EXTRA_ATTACHMENTS_MAX_BYTES = 15 * 1024 * 1024;
export const EXTRA_ATTACHMENT_EXTENSIONS = ["pdf", "xls", "xlsx", "csv", "doc", "docx", "jpg", "jpeg", "png", "heic", "heif", "webp"];
export const EXTRA_ATTACHMENTS_ACCEPT = EXTRA_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

export function extraAttachmentExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** Komunikat dla użytkownika albo null, gdy zestaw plików można wysłać. */
export function extraAttachmentsError(files: ReadonlyArray<{ name: string; size: number }>): string | null {
  if (files.length > EXTRA_ATTACHMENTS_MAX_FILES) return `Najwyżej ${EXTRA_ATTACHMENTS_MAX_FILES} dodatkowych plików.`;
  for (const f of files) {
    if (!EXTRA_ATTACHMENT_EXTENSIONS.includes(extraAttachmentExtension(f.name))) {
      return `${f.name}: dozwolone PDF, Excel, Word i zdjęcia.`;
    }
    if (f.size <= 0) return `${f.name} jest pusty.`;
  }
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > EXTRA_ATTACHMENTS_MAX_BYTES) return "Dodatkowe pliki razem przekraczają 15 MB.";
  return null;
}
