import { describe, expect, it } from "vitest";
import { isInlineImage, isPreviewableImage } from "./attachments";

const att = (filename: string, mimeType = "image/png", size = 200_000, inline?: boolean) => ({ filename, mimeType, size, inline });

describe("isInlineImage", () => {
  it("logo z podpisu, obrazki Outlooka, małe obrazki i flaga inline to obrazki z treści", () => {
    expect(isInlineImage(att("image001.png"))).toBe(true);
    expect(isInlineImage(att("Outlook-abc123.png"))).toBe(true);
    expect(isInlineImage(att("logo_mikran.jpg", "image/jpeg"))).toBe(true);
    expect(isInlineImage(att("IMG_2231.jpg", "image/jpeg", 12_000))).toBe(true);
    expect(isInlineImage(att("IMG_2231.jpg", "image/jpeg", 150_000, true))).toBe(true);
  });

  it("duże zdjęcie i dokumenty to prawdziwe załączniki", () => {
    expect(isInlineImage(att("IMG_2231.jpg", "image/jpeg", 900_000))).toBe(false);
    expect(isInlineImage(att("IMG_2231.jpg", "image/jpeg", 900_000, true))).toBe(false);
    expect(isInlineImage(att("logo-faktura.pdf", "application/pdf", 5_000))).toBe(false);
  });

  it("podgląd tylko dla typów, które endpoint serwuje inline", () => {
    expect(isPreviewableImage({ mimeType: "image/webp" })).toBe(true);
    expect(isPreviewableImage({ mimeType: "image/svg+xml" })).toBe(false);
  });
});
