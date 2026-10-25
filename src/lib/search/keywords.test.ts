import { describe, expect, it } from "vitest";
import { foldSearchText, matchesSearchWords, searchWords } from "./keywords";

describe("wyszukiwanie po słowach", () => {
  it("każde słowo w dowolnej kolejności, bez wielkości liter i polskich znaków", () => {
    expect(matchesSearchWords("Gips ECO 25 kg", "eco gips")).toBe(true);
    expect(matchesSearchWords("Gips ECO 25 kg", "eco  gips   25")).toBe(true);
    expect(matchesSearchWords("Gips ECO 25 kg", "eco wosk")).toBe(false);
    expect(matchesSearchWords("Ząb akrylowy", "zab AKRYL")).toBe(true);
    expect(matchesSearchWords("Łyżka wyciskowa", "lyzka")).toBe(true);
  });

  it("pola razem: słowa mogą być w różnych polach; puste zapytanie pasuje do wszystkiego", () => {
    expect(matchesSearchWords(["SR-6", "Śruba M6", null, 123], "m6 sr-6")).toBe(true);
    expect(matchesSearchWords(["SR-6", "Śruba M6"], "")).toBe(true);
    expect(matchesSearchWords(null, "x")).toBe(false);
  });

  it("słowa bez powtórzeń, złożone do małych liter", () => {
    expect(searchWords("  Eco ECO gips ")).toEqual(["eco", "gips"]);
    expect(foldSearchText("ĄĆĘŁŃÓŚŹŻ")).toBe("acelnoszz");
  });
});
