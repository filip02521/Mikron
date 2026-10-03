/**
 * Plik faktury / dokumentu jako wejście dla Gemini. Gemini nie czyta TIFF (skany z DHL / poczty
 * przychodzą jako .tif), więc TIFF zamieniamy na PNG — wszystkie strony jedna pod drugą.
 */

import sharp from "sharp";

export const CUSTOMS_AI_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"]);

/** Typ pliku z MIME przeglądarki, a gdy pusty / ogólny — z rozszerzenia. */
export function customsFileMime(name: string, mime: string): string {
  if (mime && mime !== "application/octet-stream") return mime === "image/tif" ? "image/tiff" : mime;
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return mime || "application/octet-stream";
}

/** Szerokość strony po konwersji — czytelna dla AI, bez wielomegabajtowych PNG. */
const TIFF_MAX_WIDTH = 2000;

export async function customsAiInlineData(
  bytes: Buffer,
  mime: string
): Promise<{ data: string; mimeType: string }> {
  if (mime !== "image/tiff") return { data: bytes.toString("base64"), mimeType: mime };
  const png = await sharp(bytes, { pages: -1 })
    .resize({ width: TIFF_MAX_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer();
  return { data: png.toString("base64"), mimeType: "image/png" };
}
