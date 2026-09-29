import { describe, expect, it } from "vitest";
import {
  buildDocumentArticleIndex,
  collectVatBasisDocuments,
  customsLineState,
  formatCustomsAgencyEmail,
  formatCustomsLines,
  normalizeArticleCode,
  normalizeCnCode,
  resolveLineVat,
  type CustomsEmailLine,
  type CustomsProductCard,
} from "./customs-clearance";

const declaration = {
  id: "doc-decl",
  fileName: "deklaracja.pdf",
  description: "Deklaracja zgodności MDR — Annex A",
};

// Fragment Annex A deklaracji zgodności Aswad (wyroby medyczne).
const aswadIndex = buildDocumentArticleIndex(
  ["DE-1411", "DE-1412", "DE-1332", "DE-1333", "DE-1370", "DE-1698", "DE-1700", "DE-1165-3", "DE-1439"].map(
    (supplierArticleCode) => ({ supplierArticleCode, document: declaration })
  )
);

function card(extra: Partial<CustomsProductCard> = {}): CustomsProductCard {
  return {
    supplierArticleCode: "DE-1196",
    descriptionPl: "Nożyk do gipsu duży",
    material: "stal nierdzewna",
    cnCode: "90184900",
    isMedicalDevice: false,
    vatRate: 23,
    vatBasisDocumentId: null,
    status: "confirmed",
    ...extra,
  };
}

describe("normalizeArticleCode", () => {
  it("ujednolica wielkość liter, spacje i myślniki", () => {
    expect(normalizeArticleCode(" de – 1196 ")).toBe("DE-1196");
    expect(normalizeArticleCode("de-1165-3")).toBe("DE-1165-3");
    expect(normalizeArticleCode(null)).toBe("");
  });
});

describe("normalizeCnCode", () => {
  it("akceptuje 8 cyfr ze spacjami lub kropkami", () => {
    expect(normalizeCnCode("9018 49 00")).toBe("90184900");
    expect(normalizeCnCode("9018.90")).toBeNull();
  });
});

describe("resolveLineVat", () => {
  it("artykuł z Annex A → 8% z deklaracją do załączenia", () => {
    const vat = resolveLineVat({ articleCode: "de-1411", card: null, documentIndex: aswadIndex });
    expect(vat).toMatchObject({ rate: 8, isMedicalDevice: true, source: "document" });
    expect(vat.basisDocument?.id).toBe("doc-decl");
  });

  it("artykuł spoza dokumentów → 23%", () => {
    const vat = resolveLineVat({ articleCode: "DE-1196", card: null, documentIndex: aswadIndex });
    expect(vat).toMatchObject({ rate: 23, isMedicalDevice: false, basisDocument: null, source: "default" });
  });

  it("zatwierdzona karta wygrywa, ale ostrzega o rozbieżności z dokumentem", () => {
    const vat = resolveLineVat({
      articleCode: "DE-1411",
      card: card({ supplierArticleCode: "DE-1411", vatRate: 23 }),
      documentIndex: aswadIndex,
    });
    expect(vat.rate).toBe(23);
    expect(vat.warning).toContain("deklaracja.pdf");
  });

  it("karta z 8% bez dokumentu — ostrzeżenie o braku załącznika", () => {
    const vat = resolveLineVat({
      articleCode: "DE-9999",
      card: card({ supplierArticleCode: "DE-9999", vatRate: 8, isMedicalDevice: true }),
      documentIndex: aswadIndex,
    });
    expect(vat.rate).toBe(8);
    expect(vat.basisDocument).toBeNull();
    expect(vat.warning).toMatch(/bez dokumentu/);
  });

  it("niezatwierdzona propozycja nie nadpisuje dokumentów", () => {
    const vat = resolveLineVat({
      articleCode: "DE-1411",
      card: card({ supplierArticleCode: "DE-1411", vatRate: 23, status: "proposed" }),
      documentIndex: aswadIndex,
    });
    expect(vat.rate).toBe(8);
  });
});

describe("customsLineState", () => {
  it("rozróżnia zatwierdzone, zmienione, propozycje i braki", () => {
    const ok = resolveLineVat({ articleCode: "DE-1196", card: card(), documentIndex: aswadIndex });
    expect(customsLineState(card(), ok)).toBe("confirmed");
    const changed = resolveLineVat({
      articleCode: "DE-1411",
      card: card({ vatRate: 23 }),
      documentIndex: aswadIndex,
    });
    expect(customsLineState(card(), changed)).toBe("confirmed_changed");
    expect(customsLineState(card({ status: "proposed" }), ok)).toBe("proposal");
    expect(customsLineState(null, ok)).toBe("missing");
  });
});

function line(position: number, descriptionPl: string, vatRate: 8 | 23, extra: Partial<CustomsEmailLine> = {}): CustomsEmailLine {
  return {
    position,
    descriptionPl,
    material: "stal nierdzewna",
    cnCode: "90184900",
    isMedicalDevice: vatRate === 8,
    vatRate,
    ...extra,
  };
}

// Pozycje 1–11 odprawy Aswad AI/3177/26.
const aswadLines: CustomsEmailLine[] = [
  line(1, "Nożyk do gipsu duży, drewniana rękojeść", 23, { material: "ostrze ze stali nierdzewnej" }),
  line(2, "Uchwyt do skalpela nr 3", 8),
  line(3, "Kleszczyki Mosquito wygięte", 8),
  line(4, "Nożyk do wosku Lessman 17cm", 23),
  line(5, "Łopatka do cementu", 8),
  line(6, "Kleszczyki Mosquito proste", 8),
  line(7, "Nożyk do gipsu mały, drewniana rękojeść", 23),
  line(8, "Nożyk do wosku", 23),
  line(9, "Nożyk do wosku", 23),
  line(10, "Nożyk do modelowania", 23),
  line(11, "Nożyk do modelowania", 23),
];

describe("formatCustomsLines", () => {
  it("łączy kolejne identyczne pozycje w zakresy", () => {
    const out = formatCustomsLines(aswadLines, false);
    expect(out).toContain("2. Uchwyt do skalpela nr 3, stal nierdzewna, wyrób medyczny, stawka VAT 8%");
    expect(out).toContain("8-9. Nożyk do wosku, stal nierdzewna, stawka VAT 23%");
    expect(out).toContain("10-11. Nożyk do modelowania, stal nierdzewna, stawka VAT 23%");
    expect(out).toHaveLength(9);
  });

  it("nie łączy identycznych pozycji, które nie sąsiadują", () => {
    const out = formatCustomsLines(
      [line(1, "Nożyk do wosku", 23), line(2, "Łopatka", 8), line(3, "Nożyk do wosku", 23)],
      false
    );
    expect(out.map((l) => l.split(" ")[0])).toEqual(["1.", "2.", "3."]);
  });
});

describe("formatCustomsAgencyEmail", () => {
  it("wspólny kod CN w nagłówku i dane importera", () => {
    const text = formatCustomsAgencyEmail({
      shipmentDescription: "przyrządy używane w protetyce stomatologicznej",
      lines: aswadLines,
    });
    expect(text).toContain("1) Dane na fakturze są poprawne");
    expect(text).toContain(
      "2) Przesyłka zawiera przyrządy używane w protetyce stomatologicznej, kod taryfy celnej dla wszystkich:\n90184900"
    );
    expect(text).toContain("3) Mikran sp. z o.o.\nul. Wojskowa 3/L4, 60-792 Poznań\nNIP: 7831008373");
    expect(text).not.toContain("kod CN");
  });

  it("różne kody CN → kod przy każdej pozycji", () => {
    const text = formatCustomsAgencyEmail({
      shipmentDescription: "przyrządy",
      lines: [line(1, "Nożyk", 23), line(2, "Szczotka", 23, { cnCode: "96032900", material: "nylon" })],
    });
    expect(text).toContain("2) Przesyłka zawiera przyrządy:");
    expect(text).toContain("1. Nożyk, stal nierdzewna, kod CN 90184900, stawka VAT 23%");
    expect(text).toContain("2. Szczotka, nylon, kod CN 96032900, stawka VAT 23%");
  });
});

describe("collectVatBasisDocuments", () => {
  it("zwraca każdą deklarację raz, tylko dla pozycji 8%", () => {
    const vats = ["DE-1411", "DE-1196", "DE-1412", "DE-1439"].map((articleCode) => ({
      vat: resolveLineVat({ articleCode, card: null, documentIndex: aswadIndex }),
    }));
    expect(collectVatBasisDocuments(vats)).toEqual([declaration]);
  });
});
