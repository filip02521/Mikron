import { describe, expect, it } from "vitest";
import { polishPozycjeLabel, polishPozycjeSubjectSuffix } from "@/lib/email/polish-plural";

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
