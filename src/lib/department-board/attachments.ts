/** Stałe i walidacja załączników zdjęć pytań na Tablicy. */

export const BOARD_IMAGE_BUCKET = "department-board-images";
export const BOARD_IMAGE_MAX_COUNT = 3;
/** Limit po kompresji (zgodny z bucketem). */
export const BOARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BOARD_IMAGE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type BoardImageMime = (typeof BOARD_IMAGE_ALLOWED_MIME)[number];

export const BOARD_IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";

/**
 * Obrazy ze schowka (Win+Shift+S / Snipping Tool / Ctrl+V).
 * Zwraca tylko pliki image/* — tekstowy paste nie jest przechwytywany.
 */
export function imageFilesFromClipboardData(
  data: DataTransfer | null | undefined
): File[] {
  if (!data) return [];

  const fromItems: File[] = [];
  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== "file") continue;
      const type = (item.type || "").toLowerCase();
      if (!type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file && file.size > 0) fromItems.push(normalizeClipboardImageFile(file));
    }
  }
  if (fromItems.length) return fromItems;

  const fromFiles: File[] = [];
  if (data.files?.length) {
    for (const file of Array.from(data.files)) {
      const type = (file.type || "").toLowerCase();
      if (!type.startsWith("image/")) continue;
      if (file.size <= 0) continue;
      fromFiles.push(normalizeClipboardImageFile(file));
    }
  }
  return fromFiles;
}

function clipboardImageExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "png";
}

/** Windows często daje pustą nazwę albo „image.png”. */
function normalizeClipboardImageFile(file: File): File {
  const mime = (file.type || "image/png").toLowerCase();
  const name = file.name?.trim() || "";
  const hasUsefulName =
    name.length > 0 &&
    name.toLowerCase() !== "image.png" &&
    name.toLowerCase() !== "image.jpg" &&
    name.toLowerCase() !== "image.jpeg" &&
    name.toLowerCase() !== "image.webp";
  if (hasUsefulName) return file;
  const ext = clipboardImageExtension(mime);
  return new File([file], `zrzut-${Date.now()}.${ext}`, {
    type: mime.startsWith("image/") ? mime : "image/png",
    lastModified: file.lastModified || Date.now(),
  });
}

export function isBoardImageMime(value: string | null | undefined): value is BoardImageMime {
  if (!value) return false;
  return (BOARD_IMAGE_ALLOWED_MIME as readonly string[]).includes(value);
}

export function boardImageStoragePrefix(threadId: string): string {
  return `board/${threadId.trim()}/`;
}

export function isBoardImageStoragePath(path: string, threadId?: string): boolean {
  const trimmed = path.trim();
  if (!trimmed.startsWith("board/") || trimmed.includes("..")) return false;
  if (threadId) {
    return trimmed.startsWith(boardImageStoragePrefix(threadId));
  }
  return /^board\/[0-9a-f-]{36}\/[0-9a-f-]+\.(jpe?g|png|webp|pdf|xlsx|xls|docx|doc|csv)$/i.test(trimmed);
}

// ─── Pliki od dostawcy (załączniki maila dołączone do odpowiedzi na tablicy) ───

/** Ile plików od dostawcy w jednej odpowiedzi i jak duże (oferty, karty katalogowe, cenniki). */
export const BOARD_SUPPLIER_FILE_MAX_COUNT = 5;
export const BOARD_SUPPLIER_FILE_MAX_BYTES = 15 * 1024 * 1024;

/** Rozszerzenie w magazynie → typ; inne pliki (np. .html, .exe) nie trafiają na tablicę. */
const BOARD_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  csv: "text/csv",
};

/** Plik od dostawcy, który można dołączyć do odpowiedzi: rozszerzenie i typ do zapisu. null = nieobsługiwany. */
export function boardSupplierFileType(filename: string): { ext: string; mime: string } | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const mime = BOARD_FILE_TYPES[ext];
  if (!mime) return null;
  return { ext: ext === "jpeg" ? "jpg" : ext, mime };
}

export function isBoardImageAttachment(mime: string | null | undefined): boolean {
  return Boolean(mime && mime.toLowerCase().startsWith("image/"));
}

export function validateBoardImageFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!file || file.size <= 0) return "Plik jest pusty.";
  if (file.size > BOARD_IMAGE_MAX_BYTES) {
    return `Zdjęcie jest za duże (max ${BOARD_IMAGE_MAX_BYTES / (1024 * 1024)} MB po kompresji).`;
  }
  const mime = file.type?.toLowerCase() || "";
  // Po kompresji zawsze jpeg; akceptujemy też png/webp z inputu przed kompresją na serwerze.
  if (!isBoardImageMime(mime) && mime !== "image/jpg") {
    return "Dozwolone formaty: JPEG, PNG, WebP.";
  }
  return null;
}

export function validateBoardImageBatch(count: number): string | null {
  if (count < 0) return "Nieprawidłowa liczba zdjęć.";
  if (count > BOARD_IMAGE_MAX_COUNT) {
    return `Możesz dodać maksymalnie ${BOARD_IMAGE_MAX_COUNT} zdjęcia.`;
  }
  return null;
}

/** Minimalna weryfikacja magicznych bajtów (serwer). */
export function looksLikeBoardImageBytes(
  bytes: Uint8Array | ArrayBuffer,
  mime: string
): boolean {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (buffer.length < 12) return false;
  if (mime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === "image/webp") {
    const asAscii = (start: number, end: number) =>
      String.fromCharCode(...buffer.slice(start, end));
    return asAscii(0, 4) === "RIFF" && asAscii(8, 12) === "WEBP";
  }
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export type BoardThreadAttachmentRow = {
  id: string;
  thread_id: string;
  post_id?: string | null;
  created_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number | null;
  sort_order: number;
  created_at: string;
};

/** Bez post_id — fallback, gdy migracja 166 nie jest jeszcze zastosowana. */
export const DEPARTMENT_BOARD_ATTACHMENT_SELECT_LEGACY =
  "id, thread_id, created_by, storage_path, file_name, mime_type, byte_size, sort_order, created_at";

export const DEPARTMENT_BOARD_ATTACHMENT_SELECT = `${DEPARTMENT_BOARD_ATTACHMENT_SELECT_LEGACY}, post_id`;

// ─── Pliki dołączane przez użytkownika (pytanie handlowca, odpowiedź zakupów) ───

/** Dokumenty (nie zdjęcia): te same typy co pliki od dostawcy, bez kompresji. */
export const BOARD_DOCUMENT_EXTENSIONS = ["pdf", "xlsx", "xls", "docx", "doc", "csv"] as const;
export const BOARD_DOCUMENT_ACCEPT = BOARD_DOCUMENT_EXTENSIONS.map((e) => `.${e}`).join(",");
/** Jedno pole „Zdjęcia i pliki”: zdjęcia idą kompresją, dokumenty bez zmian. */
export const BOARD_FILE_ACCEPT = `${BOARD_IMAGE_ACCEPT},${BOARD_DOCUMENT_ACCEPT}`;
export const BOARD_DOCUMENT_MAX_COUNT = BOARD_SUPPLIER_FILE_MAX_COUNT;
export const BOARD_DOCUMENT_MAX_BYTES = BOARD_SUPPLIER_FILE_MAX_BYTES;
/** Wszystkie pliki jednej wiadomości razem — zostaje miejsce na zdjęcia pod limitem akcji serwera (20 MB). */
export const BOARD_DOCUMENT_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
/** ponytail: proxy przed ontime.mikran.pl ucina żądania ~1 MB; po podniesieniu client_max_body_size — usuń ostrzeżenie. */
export const BOARD_PROXY_SOFT_LIMIT_BYTES = 1024 * 1024;

/** Dokument do dołączenia (PDF, Excel, Word, CSV) albo null — zdjęcie lub nieobsługiwany typ. */
export function boardDocumentFileType(filename: string): { ext: string; mime: string } | null {
  const t = boardSupplierFileType(filename);
  return t && (BOARD_DOCUMENT_EXTENSIONS as readonly string[]).includes(t.ext) ? t : null;
}

/** Komunikat dla użytkownika albo null. Te same reguły w przeglądarce i w akcji serwera. */
export function validateBoardDocuments(files: ReadonlyArray<{ name: string; size: number }>): string | null {
  if (files.length > BOARD_DOCUMENT_MAX_COUNT) return `Możesz dołączyć najwyżej ${BOARD_DOCUMENT_MAX_COUNT} plików.`;
  for (const f of files) {
    if (!boardDocumentFileType(f.name)) return `„${f.name}”: dozwolone PDF, Excel, Word i CSV.`;
    if (!(f.size > 0)) return `„${f.name}” jest pusty.`;
    if (f.size > BOARD_DOCUMENT_MAX_BYTES) return `„${f.name}” jest za duży (max ${BOARD_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB).`;
  }
  if (files.reduce((n, f) => n + f.size, 0) > BOARD_DOCUMENT_MAX_TOTAL_BYTES) {
    return `Pliki razem przekraczają ${BOARD_DOCUMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB - wyślij część w kolejnej wiadomości.`;
  }
  return null;
}

/** Pierwsze bajty zgodne z rozszerzeniem (serwer): .pdf to PDF, .xlsx/.docx to ZIP, .xls/.doc to OLE, CSV to tekst. */
export function looksLikeBoardDocumentBytes(bytes: Uint8Array | ArrayBuffer, ext: string): boolean {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4) return false;
  const starts = (sig: number[]) => sig.every((v, i) => b[i] === v);
  if (ext === "pdf") return starts([0x25, 0x50, 0x44, 0x46]);
  if (ext === "xlsx" || ext === "docx") return starts([0x50, 0x4b, 0x03, 0x04]);
  if (ext === "xls" || ext === "doc") return starts([0xd0, 0xcf, 0x11, 0xe0]);
  if (ext === "csv") return !b.subarray(0, 4096).includes(0);
  return false;
}

/**
 * Wklejenie (Ctrl+V): zrzuty ekranu jak dotąd oraz pliki skopiowane w Eksploratorze (PDF, Excel…).
 * Tekst nie jest przechwytywany — pusta lista, gdy w schowku nie ma plików.
 */
export function boardFilesFromClipboardData(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const images = imageFilesFromClipboardData(data);
  const documents = Array.from(data.files ?? []).filter((f) => f.size > 0 && boardDocumentFileType(f.name));
  return [...images, ...documents];
}

/** Krótka etykieta typu na kafelku pliku: „PDF”, „XLSX”, „DOCX”, „CSV”. */
export function boardFileTypeLabel(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ext && ext.length <= 4 ? ext.toUpperCase() : "PLIK";
}

/** „840 kB”, „1,3 MB” — rozmiar na kafelku i w podsumowaniu. */
export function formatBoardFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}
