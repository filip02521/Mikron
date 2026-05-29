import { describe, expect, it } from "vitest";
import { extractKhLabelFromDocument } from "./kontrahent-from-document";
import type { SubiektDocument } from "./types";

describe("extractKhLabelFromDocument", () => {
  it("czyta nazwę z embed kontrahenta w ZD", () => {
    const doc = {
      dok_Id: 1,
      kh__Kontrahent_Platnik: {
        kh_Id: 688,
        kh_Symbol: "IVOCLAR",
        adr_NazwaPelna: "Ivoclar-Vivadent Polska sp. z o.o.",
      },
    } as SubiektDocument;
    expect(extractKhLabelFromDocument(doc, 688)).toContain("Ivoclar");
  });
});
