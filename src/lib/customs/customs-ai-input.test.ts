import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { customsAiInlineData, customsFileMime } from "./customs-ai-input";

describe("customsFileMime", () => {
  it("rozpoznaje TIF po rozszerzeniu, gdy przeglądarka nie poda typu", () => {
    expect(customsFileMime("7603442523.inv.hkg.tif", "")).toBe("image/tiff");
    expect(customsFileMime("skan.TIFF", "application/octet-stream")).toBe("image/tiff");
    expect(customsFileMime("faktura.pdf", "application/pdf")).toBe("application/pdf");
  });
});

describe("customsAiInlineData", () => {
  it("TIFF zamienia na PNG dla Gemini, PDF zostawia", async () => {
    const tiff = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#fff" } }).tiff().toBuffer();
    const out = await customsAiInlineData(tiff, "image/tiff");
    expect(out.mimeType).toBe("image/png");
    expect((await sharp(Buffer.from(out.data, "base64")).metadata()).format).toBe("png");
    const pdf = await customsAiInlineData(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(pdf).toEqual({ data: Buffer.from("%PDF-1.4").toString("base64"), mimeType: "application/pdf" });
  });
});
