import { describe, expect, it } from "vitest";
import { plCoTydzien, plPozycja, plZaznaczonaPozycja } from "@/lib/ui/polish-plurals";

describe("polish-plurals", () => {
  it("odmienia pozycja", () => {
    expect(plPozycja(1)).toBe("pozycja");
    expect(plPozycja(2)).toBe("pozycje");
    expect(plPozycja(4)).toBe("pozycje");
    expect(plPozycja(5)).toBe("pozycji");
    expect(plPozycja(12)).toBe("pozycji");
    expect(plPozycja(22)).toBe("pozycje");
  });

  it("odmienia zaznaczona pozycja", () => {
    expect(plZaznaczonaPozycja(1)).toBe("zaznaczonej pozycji");
    expect(plZaznaczonaPozycja(3)).toBe("zaznaczonych pozycji");
  });

  it("odmienia co tydzień", () => {
    expect(plCoTydzien(1)).toBe("Co tydzień");
    expect(plCoTydzien(2)).toBe("Co 2 tygodnie");
    expect(plCoTydzien(5)).toBe("Co 5 tygodni");
  });
});
