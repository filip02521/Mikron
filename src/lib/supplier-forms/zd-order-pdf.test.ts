import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { emailsInText } from "@/lib/supplier-forms/prepare";
import { formatOrderQty, renderZdOrderPdf, wrapText, zdOrderPdfFileName } from "@/lib/supplier-forms/zd-order-pdf";

describe("zd-order-pdf", () => {
  it("PDF z polskimi znakami; długa lista przechodzi na kolejne strony", async () => {
    const lines = Array.from({ length: 80 }, (_, i) => ({
      symbol: `ŁĄ-${i}`,
      name: `Folia Erkodur okrągła 120mm ${i},0mm (100szt) — zażółć gęślą jaźń, bardzo długa nazwa towaru do zawinięcia`,
      qty: i + 0.5,
    }));
    const bytes = await renderZdOrderPdf({
      dokNr: "ZD 123/26",
      date: new Date(2026, 9, 4),
      supplierName: "Dreve Dentamid GmbH",
      lines,
      english: false,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Zamówienie ZD 123/26");
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("wersja angielska", async () => {
    const doc = await PDFDocument.load(
      await renderZdOrderPdf({
        dokNr: "ZD 7/26",
        date: new Date(2026, 9, 4),
        supplierName: "Shenzhen Upcera Dental",
        lines: [{ symbol: null, name: "Zirconia disc 98x14", qty: 10 }],
        english: true,
      })
    );
    expect(doc.getTitle()).toBe("Purchase order ZD 7/26");
    expect(doc.getPageCount()).toBe(1);
  });

  it("łamanie tekstu i formaty", () => {
    const w = (s: string) => s.length;
    expect(wrapText("ala ma kota", 6, w)).toEqual(["ala ma", "kota"]);
    expect(wrapText("abcdefghij", 4, w)).toEqual(["abcd", "efgh", "ij"]);
    expect(formatOrderQty(12)).toBe("12");
    expect(formatOrderQty(2.5)).toBe("2,5");
    expect(zdOrderPdfFileName("ZD 123/26", false)).toBe("Zamowienie ZD 123_26.pdf");
    expect(zdOrderPdfFileName("ZD 123/26", true)).toBe("Purchase order ZD 123_26.pdf");
  });
});


describe("emailsInText", () => {
  it("wyłuskuje adresy z karty dostawcy", () => {
    expect(emailsInText("Zamówienia: Order@Renfert.de; tel. 123, kontakt <jan.kowalski@dental.pl> order@renfert.de")).toEqual([
      "order@renfert.de",
      "jan.kowalski@dental.pl",
    ]);
  });

  it("prefiks mailto: albo etykieta z dwukropkiem nie wchodzi do adresu", () => {
    expect(emailsInText("mailto:order@renfert.de kontakt:jan@dental.pl")).toEqual(["order@renfert.de", "jan@dental.pl"]);
  });
});
