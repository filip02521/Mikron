import { describe, expect, it } from "vitest";
import {
  polishPlural,
  polishPluralWord,
  polishPozycjeLabel,
  polishPozycjeSubjectSuffix,
} from "@/lib/email/polish-plural";

describe("polishPozycjeLabel", () => {
  it("odmienia poprawnie", () => {
    expect(polishPozycjeLabel(1)).toBe("1 pozycja");
    expect(polishPozycjeLabel(2)).toBe("2 pozycje");
    expect(polishPozycjeLabel(4)).toBe("4 pozycje");
    expect(polishPozycjeLabel(5)).toBe("5 pozycji");
    expect(polishPozycjeLabel(22)).toBe("22 pozycje");
    expect(polishPozycjeLabel(25)).toBe("25 pozycji");
  });

  it("suffix do tematu", () => {
    expect(polishPozycjeSubjectSuffix(3)).toBe("(3 pozycje)");
  });
});

describe("polishPlural", () => {
  it("odmienia 1 / 2–4 / 5+ / 12–14 / 22–24", () => {
    const f = (n: number) => polishPlural(n, "prośba", "prośby", "próśb");
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 24, 25].map(f)).toEqual([
      "1 prośba", "2 prośby", "4 prośby", "5 próśb", "11 próśb", "12 próśb",
      "14 próśb", "21 próśb", "22 prośby", "24 prośby", "25 próśb",
    ]);
    expect(polishPluralWord(5, "została", "zostały", "zostało")).toBe("zostało");
  });
});
