import { describe, expect, it } from "vitest";
import { plCoTydzien, plPozycja, plProsba, plWiersz, plZaznaczonaPozycja } from "@/lib/ui/polish-plurals";

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

  it("odmienia prośba", () => {
    expect(plProsba(1)).toBe("prośba");
    expect(plProsba(2)).toBe("prośby");
    expect(plProsba(4)).toBe("prośby");
    expect(plProsba(5)).toBe("próśb");
    expect(plProsba(12)).toBe("próśb");
    expect(plProsba(22)).toBe("prośby");
    expect(plProsba(25)).toBe("próśb");
  });

  it("odmienia wiersz", () => {
    expect(plWiersz(1)).toBe("wiersz");
    expect(plWiersz(2)).toBe("wiersze");
    expect(plWiersz(4)).toBe("wiersze");
    expect(plWiersz(5)).toBe("wierszy");
    expect(plWiersz(12)).toBe("wierszy");
    expect(plWiersz(22)).toBe("wiersze");
  });
});
