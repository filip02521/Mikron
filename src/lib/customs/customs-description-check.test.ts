import { describe, expect, it } from "vitest";
import { customsDescriptionWarning } from "./customs-description-check";
import { emailRangeConflicts, parseCustomsEmailText } from "./customs-email-import";

describe("customsDescriptionWarning — błędy z historycznych tłumaczeń", () => {
  it("lista kilku części w jednym opisie (Saeshin 5-43)", () => {
    const w = customsDescriptionWarning(
      "Części do prostnic: 5 podkładka; 6 zacisk wiertła; 7 przewód elektryczny; 9-10 podkładka",
      '105L(BL):COLLET CHUCK "A"'
    );
    expect(w).toMatch(/listę kilku pozycji/);
  });

  it("wymiary z jednostkami to nie lista pozycji", () => {
    expect(customsDescriptionWarning("Krążki cyrkonowe: 98 mm średnicy, 14 mm grubości", "Explore ML A1 D98-14")).toBeNull();
    expect(customsDescriptionWarning("Wiertła, 20 szt. w opakowaniu, 3 szt. zapasowe", "T Burs Mag")).toBeNull();
  });

  it("inny rozmiar niż na fakturze (Aswad Beebe)", () => {
    expect(customsDescriptionWarning("Nożyczki do koron BeeBee 120mm wygięte", "Beebe Saw.edge.Curved 110mm")).toMatch(
      /Rozmiar w opisie \(120 mm\) inny niż na fakturze \(110 mm\)/
    );
    expect(customsDescriptionWarning("Nożyczki do koron 11 cm", "Beebe Curved 110mm")).toBeNull();
  });

  it("sprzeczny materiał (Upcera dwukrzemian litu opisany jako ceramika hybrydowa)", () => {
    expect(
      customsDescriptionWarning(
        "Ceramika hybrydowa na uzupełnienia protetyczne",
        "Dental Lithium Disilicate Glass Ceramic LT VBL2-R(18-15-13)"
      )
    ).toMatch(/Materiał w opisie \(ceramika hybrydowa\) nie zgadza się z fakturą \(dwukrzemian litu\)/);
  });

  it("bez fałszywych alarmów: Explore Hybrid to cyrkon, ogólny opis bez materiału, zgodny opis", () => {
    expect(
      customsDescriptionWarning("Krążki z cyrkonu dentystycznego", "Dental Zirconia Ceramic Explore Hybrid A3 D98-30 F")
    ).toBeNull();
    expect(customsDescriptionWarning("Uzupełnienia protetyczne", "Dental Lithium Disilicate Glass Ceramic")).toBeNull();
    expect(customsDescriptionWarning("Krążki PMMA na prace tymczasowe", "PMMA Block D98-25 A3")).toBeNull();
    expect(customsDescriptionWarning("Prostnica do mikrosilnika, 2 prędkości", "FORTE100III HANDPIECE")).toBeNull();
  });
});

describe("emailRangeConflicts", () => {
  const lines = [
    { position: 29, supplierArticleCode: "DE-1179", supplierName: "Zahle Cement Spatula" },
    { position: 30, supplierArticleCode: "DE-1172", supplierName: "Le Cron Cement Spatula" },
    { position: 31, supplierArticleCode: "DE-1174", supplierName: "MSY Cement Spatula" },
    { position: 8, supplierArticleCode: "DE-1188", supplierName: "Lessmann Fig 1" },
    { position: 9, supplierArticleCode: "DE-1195", supplierName: "Wax Knives Large" },
  ];

  it("opis konkretnego artykułu na zakres z innymi kodami (Aswad 29-31)", () => {
    const parsed = parseCustomsEmailText("29-31. Nożyk do modelowania Zahle DE-1179 nr 10, stawka VAT 23%");
    const w = emailRangeConflicts(parsed.ranges, lines);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/Poz\. 29-31: .* wskazuje poz\. 29, a obejmuje też 30 \(DE-1172\), 31 \(DE-1174\)/);
  });

  it("ogólny opis zakresu — bez ostrzeżenia", () => {
    const parsed = parseCustomsEmailText("8-9. Nożyk do wosku, stawka VAT 23%");
    expect(emailRangeConflicts(parsed.ranges, lines)).toEqual([]);
  });
});
