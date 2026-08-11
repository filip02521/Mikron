import { describe, expect, it } from "vitest";
import {
  BOARD_IMAGE_MAX_COUNT,
  boardImageStoragePrefix,
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
