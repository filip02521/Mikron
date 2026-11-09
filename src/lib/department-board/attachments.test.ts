import { describe, expect, it } from "vitest";
import {
  BOARD_IMAGE_MAX_COUNT,
  boardDocumentFileType,
  boardFilesFromClipboardData,
  boardFileTypeLabel,
  formatBoardFileSize,
  looksLikeBoardDocumentBytes,
  validateBoardDocuments,
  boardImageStoragePrefix,
  boardSupplierFileType,
  isBoardImageAttachment,
  imageFilesFromClipboardData,
  isBoardImageMime,
  isBoardImageStoragePath,
  looksLikeBoardImageBytes,
  validateBoardImageBatch,
  validateBoardImageFile,
} from "@/lib/department-board/attachments";

describe("board attachments validation", () => {
  it("accepts jpeg/png/webp mime", () => {
    expect(isBoardImageMime("image/jpeg")).toBe(true);
    expect(isBoardImageMime("image/png")).toBe(true);
    expect(isBoardImageMime("image/webp")).toBe(true);
    expect(isBoardImageMime("application/pdf")).toBe(false);
  });

  it("validates file size and mime", () => {
    expect(
      validateBoardImageFile({ name: "a.jpg", type: "image/jpeg", size: 100 })
    ).toBeNull();
    expect(
      validateBoardImageFile({ name: "a.jpg", type: "image/jpeg", size: 0 })
    ).toMatch(/pusty/i);
    expect(
      validateBoardImageFile({
        name: "a.jpg",
        type: "image/jpeg",
        size: 6 * 1024 * 1024,
      })
    ).toMatch(/za duże/i);
    expect(
      validateBoardImageFile({ name: "a.gif", type: "image/gif", size: 100 })
    ).toMatch(/format/i);
  });

  it("limits batch count", () => {
    expect(validateBoardImageBatch(0)).toBeNull();
    expect(validateBoardImageBatch(BOARD_IMAGE_MAX_COUNT)).toBeNull();
    expect(validateBoardImageBatch(BOARD_IMAGE_MAX_COUNT + 1)).toMatch(/maksymalnie/i);
  });

  it("validates storage paths", () => {
    const tid = "11111111-1111-4111-8111-111111111111";
    const path = `${boardImageStoragePrefix(tid)}22222222-2222-4222-8222-222222222222.jpg`;
    expect(isBoardImageStoragePath(path)).toBe(true);
    expect(isBoardImageStoragePath(path, tid)).toBe(true);
    expect(isBoardImageStoragePath(path, "other")).toBe(false);
    expect(isBoardImageStoragePath("board/../etc/passwd")).toBe(false);
    expect(isBoardImageStoragePath("teeth-ocr/x.jpg")).toBe(false);
  });

  it("sniffs jpeg/png/webp magic bytes", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(12).fill(0)]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...Array(12).fill(0)]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0,
    ]);
    expect(looksLikeBoardImageBytes(jpeg, "image/jpeg")).toBe(true);
    expect(looksLikeBoardImageBytes(png, "image/png")).toBe(true);
    expect(looksLikeBoardImageBytes(webp, "image/webp")).toBe(true);
    expect(looksLikeBoardImageBytes(jpeg, "image/png")).toBe(false);
    expect(looksLikeBoardImageBytes(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe(
      false
    );
  });
});

describe("imageFilesFromClipboardData", () => {
  function mockClipboard(items: Array<{ type: string; file: File | null }>): DataTransfer {
    return {
      items: {
        length: items.length,
        [Symbol.iterator]: function* () {
          for (const item of items) {
            yield {
              kind: "file" as const,
              type: item.type,
              getAsFile: () => item.file,
            };
          }
        },
      },
      files: {
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      },
    } as unknown as DataTransfer;
  }

  it("wyciąga PNG ze schowka (jak Win+Shift+S)", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "image.png", {
      type: "image/png",
    });
    const files = imageFilesFromClipboardData(
      mockClipboard([{ type: "image/png", file: png }])
    );
    expect(files).toHaveLength(1);
    expect(files[0]?.type).toBe("image/png");
    expect(files[0]?.name).toMatch(/^zrzut-\d+\.png$/);
  });

  it("ignoruje tekst i puste pliki", () => {
    expect(imageFilesFromClipboardData(null)).toEqual([]);
    const empty = new File([], "image.png", { type: "image/png" });
    const files = imageFilesFromClipboardData(
      mockClipboard([
        { type: "text/plain", file: null },
        { type: "image/png", file: empty },
      ])
    );
    expect(files).toEqual([]);
  });

  it("zachowuje sensowną nazwę pliku", () => {
    const named = new File([new Uint8Array([9])], "etykieta.webp", {
      type: "image/webp",
    });
    const files = imageFilesFromClipboardData(
      mockClipboard([{ type: "image/webp", file: named }])
    );
    expect(files[0]?.name).toBe("etykieta.webp");
  });
});

describe("pliki od dostawcy na tablicy", () => {
  it("PDF, zdjęcia, Excel, Word, CSV — tak; HTML, EXE, ZIP — nie", () => {
    expect(boardSupplierFileType("Oferta 2026-10.PDF")).toEqual({ ext: "pdf", mime: "application/pdf" });
    expect(boardSupplierFileType("karta.jpeg")).toEqual({ ext: "jpg", mime: "image/jpeg" });
    expect(boardSupplierFileType("cennik.xlsx")?.ext).toBe("xlsx");
    expect(boardSupplierFileType("warunki.docx")?.ext).toBe("docx");
    expect(boardSupplierFileType("strona.html")).toBeNull();
    expect(boardSupplierFileType("setup.exe")).toBeNull();
    expect(boardSupplierFileType("paczka.zip")).toBeNull();
    expect(boardSupplierFileType("bez-rozszerzenia")).toBeNull();
  });

  it("ścieżka w magazynie dopuszcza PDF; zdjęcie odróżnione od pliku", () => {
    expect(isBoardImageStoragePath("board/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.pdf")).toBe(true);
    expect(isBoardImageStoragePath("board/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.html")).toBe(false);
    expect(isBoardImageAttachment("image/png")).toBe(true);
    expect(isBoardImageAttachment("application/pdf")).toBe(false);
  });
});


describe("pliki dołączane na Tablicy", () => {
  it("dokumenty: PDF, Excel, Word, CSV tak; zdjęcia i inne typy nie", () => {
    expect(boardDocumentFileType("oferta.PDF")).toEqual({ ext: "pdf", mime: "application/pdf" });
    expect(boardDocumentFileType("cennik.xlsx")?.ext).toBe("xlsx");
    expect(boardDocumentFileType("zdjecie.jpg")).toBeNull();
    expect(boardDocumentFileType("skrypt.exe")).toBeNull();
  });

  it("walidacja: liczba, typ, pusty i za duży plik", () => {
    expect(validateBoardDocuments([{ name: "a.pdf", size: 10 }])).toBeNull();
    expect(validateBoardDocuments(Array.from({ length: 6 }, (_, i) => ({ name: `${i}.pdf`, size: 1 })))).toMatch(/najwyżej 5/);
    expect(validateBoardDocuments([{ name: "a.zip", size: 10 }])).toMatch(/dozwolone/);
    expect(validateBoardDocuments([{ name: "a.pdf", size: 0 }])).toMatch(/pusty/);
    expect(validateBoardDocuments([{ name: "a.pdf", size: 16 * 1024 * 1024 }])).toMatch(/za duży/);
    expect(validateBoardDocuments([{ name: "a.pdf", size: 8 * 1024 * 1024 }, { name: "b.pdf", size: 8 * 1024 * 1024 }])).toMatch(/razem przekraczają 15 MB/);
  });

  it("pierwsze bajty muszą pasować do rozszerzenia", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(looksLikeBoardDocumentBytes(enc("%PDF-1.7"), "pdf")).toBe(true);
    expect(looksLikeBoardDocumentBytes(enc("<html>"), "pdf")).toBe(false);
    expect(looksLikeBoardDocumentBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]), "xlsx")).toBe(true);
    expect(looksLikeBoardDocumentBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1]), "xls")).toBe(true);
    expect(looksLikeBoardDocumentBytes(enc("symbol;ilosc\nA;1"), "csv")).toBe(true);
    expect(looksLikeBoardDocumentBytes(new Uint8Array([0x41, 0, 0x42, 0x43]), "csv")).toBe(false);
  });
});

describe("schowek i opis plików na Tablicy", () => {
  it("wklejenie: zrzut ekranu i skopiowany PDF; plik nieobsługiwany pominięty", () => {
    const png = new File([new Uint8Array([1])], "image.png", { type: "image/png" });
    const pdf = new File([new Uint8Array([1])], "oferta.pdf", { type: "application/pdf" });
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/octet-stream" });
    const data = { items: [], files: [png, pdf, exe] } as unknown as DataTransfer;
    const out = boardFilesFromClipboardData(data);
    expect(out.map((f) => f.type)).toEqual(["image/png", "application/pdf"]);
    expect(out[0]!.name).toMatch(/^zrzut-\d+\.png$/);
    expect(boardFilesFromClipboardData(null)).toEqual([]);
  });

  it("etykieta typu i rozmiar", () => {
    expect(boardFileTypeLabel("Cennik 2027.xlsx")).toBe("XLSX");
    expect(boardFileTypeLabel("bez-rozszerzenia")).toBe("PLIK");
    expect(formatBoardFileSize(1300 * 1024)).toBe("1,3 MB");
    expect(formatBoardFileSize(200)).toBe("1 kB");
    expect(formatBoardFileSize(null)).toBe("");
  });
});
