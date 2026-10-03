import { describe, expect, it } from "vitest";
import { customsCnWarnings, type CustomsCardView } from "./customs-view";

function card(descriptionPl: string, cnCode: string, material = "stal"): CustomsCardView {
  return {
    id: descriptionPl + cnCode,
    supplierArticleCode: "X",
    descriptionPl,
    material,
    cnCode,
    isMedicalDevice: false,
    vatRate: 23,
    vatBasisDocumentId: null,
    status: "proposed",
    source: "ai",
    confirmedAt: null,
  };
}

describe("customsCnWarnings", () => {
  it("ten sam opis z różnymi kodami — ostrzeżenie przy obu pozycjach", () => {
    const w = customsCnWarnings([
      { position: 5, card: card("Podkładka", "73182200"), invoiceHsCode: null },
      { position: 9, card: card("Podkładka", "84833080"), invoiceHsCode: null },
      { position: 10, card: card("Podkładka", "73182200"), invoiceHsCode: null },
      { position: 34, card: card("Łożyska kulkowe", "84821090"), invoiceHsCode: null },
    ]);
    expect(w.get(5)).toMatch(/poz\. 9 \(8483 30 80\)/);
    expect(w.get(9)).toMatch(/poz\. 5 \(7318 22 00\), 10 \(7318 22 00\)/);
    expect(w.has(34)).toBe(false);
  });

  it("inna pozycja niż HS nadawcy — ostrzeżenie; zgodna pozycja — cisza", () => {
    const w = customsCnWarnings([
      { position: 1, card: card("Wiertła do frezarek", "82077090", "węglik"), invoiceHsCode: "8207909000" },
      { position: 2, card: card("Igła grawerska", "84661020", "stal"), invoiceHsCode: "8207909000" },
    ]);
    expect(w.has(1)).toBe(false);
    expect(w.get(2)).toMatch(/HS 8207909000 \(pozycja 8207\), a CN to 8466 10 20/);
  });
});
