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
  return /^board\/[0-9a-f-]{36}\/[0-9a-f-]+\.(jpe?g|png|webp)$/i.test(trimmed);
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
  created_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number | null;
  sort_order: number;
  created_at: string;
};

export const DEPARTMENT_BOARD_ATTACHMENT_SELECT =
  "id, thread_id, created_by, storage_path, file_name, mime_type, byte_size, sort_order, created_at";
