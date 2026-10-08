import { describe, expect, it } from "vitest";
import { splitEmphasis } from "./emphasis";

describe("splitEmphasis", () => {
  it("*tekst* na początku linii i w nawiasie to pogrubienie, reszta zostaje", () => {
    expect(splitEmphasis("*ładunek:*\n1 półpaleta (*uwaga* niebezpieczny)")).toEqual([
      { bold: true, text: "ładunek:" },
      { bold: false, text: "\n1 półpaleta (" },
      { bold: true, text: "uwaga" },
      { bold: false, text: " niebezpieczny)" },
    ]);
  });

  it("gwiazdki w środku słowa, ze spacjami albo przez wiele linii zostają gwiazdkami", () => {
    for (const t of ["2*3*4", "a * b * c", "*start\nkoniec*", "cena*"]) {
      expect(splitEmphasis(t)).toEqual([{ bold: false, text: t }]);
    }
  });
});
