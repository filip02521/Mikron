/**
 * Kompresja zdjęć po stronie klienta (canvas → JPEG).
 * Wspólne dla Tablicy i OCR zębów.
 */

export const COMPRESS_IMAGE_MAX_DIMENSION = 1600;
export const COMPRESS_IMAGE_JPEG_QUALITY = 0.85;
/** Limit pliku wejściowego przed kompresją. */
export const COMPRESS_IMAGE_MAX_INPUT_BYTES = 20 * 1024 * 1024;

export type CompressImageOptions = {
  maxDimension?: number;
  quality?: number;
  /** Gdy canvas/toBlob zawiedzie — rzuć zamiast zwracać oryginał. */
  mimeType?: "image/jpeg";
};

export async function compressImageFile(
  file: File,
  options?: CompressImageOptions
): Promise<Blob> {
  const maxDimension = options?.maxDimension ?? COMPRESS_IMAGE_MAX_DIMENSION;
  const quality = options?.quality ?? COMPRESS_IMAGE_JPEG_QUALITY;
  const mimeType = options?.mimeType ?? "image/jpeg";

  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Nie udało się przetworzyć obrazu");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Nie udało się skompresować obrazu"))),
        mimeType,
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}
