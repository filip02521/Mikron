import { describe, expect, it } from "vitest";
import {
  MAIL_ATTACHMENTS_COMBINED_MAX_BYTES,
  mailAttachmentsCombinedError,
  primaryZdOverrideError,
} from "@/lib/email/extra-attachments";

describe("primaryZdOverrideError", () => {
  it("akceptuje PDF", () => {
    expect(primaryZdOverrideError({ name: "ZD.pdf", size: 1200 })).toBeNull();
  });

  it("odrzuca zdjęcie", () => {
    expect(primaryZdOverrideError({ name: "scan.png", size: 1200 })).toMatch(/PDF|Excel/i);
  });

  it("odrzuca pusty plik", () => {
    expect(primaryZdOverrideError({ name: "ZD.pdf", size: 0 })).toMatch(/pusty/i);
  });
});

describe("mailAttachmentsCombinedError", () => {
  it("akceptuje rozsądny zestaw", () => {
    expect(
      mailAttachmentsCombinedError(
        { name: "ZD.pdf", size: 2_000_000 },
        [{ name: "a.pdf", size: 1_000_000 }]
      )
    ).toBeNull();
  });

  it("odrzuca sumę ponad limit", () => {
    expect(
      mailAttachmentsCombinedError(
        { name: "ZD.pdf", size: MAIL_ATTACHMENTS_COMBINED_MAX_BYTES - 100 },
        [{ name: "a.pdf", size: 200 }]
      )
    ).toMatch(/18 MB/i);
  });
});
