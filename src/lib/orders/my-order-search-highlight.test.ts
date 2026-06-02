import { describe, expect, it } from "vitest";
import { splitTextBySearchHighlight } from "./my-order-search-highlight";

describe("splitTextBySearchHighlight", () => {
  it("bez zapytania zwraca jeden segment", () => {
    expect(splitTextBySearchHighlight("Straumann", "")).toEqual([
      { text: "Straumann", match: false },
    ]);
  });

  it("podświetla dopasowany fragment", () => {
    const parts = splitTextBySearchHighlight("Straumann Polska", "strau");
    expect(parts.some((p) => p.match && p.text.toLowerCase().startsWith("strau"))).toBe(
      true
    );
  });

  it("łączy sąsiednie trafienia", () => {
    const parts = splitTextBySearchHighlight("Alfa Beta", "alfa beta");
    const matched = parts.filter((p) => p.match).map((p) => p.text).join("");
    expect(matched.toLowerCase()).toContain("alfa");
    expect(matched.toLowerCase()).toContain("beta");
  });

  it("działa z polskimi znakami w tekście", () => {
    const parts = splitTextBySearchHighlight("Klinika Łódź", "lodz");
    expect(parts.some((p) => p.match)).toBe(true);
  });

  it("podświetla cały tekst gdy cały pasuje", () => {
    const parts = splitTextBySearchHighlight("Straumann", "straumann");
    expect(parts).toEqual([{ text: "Straumann", match: true }]);
  });
});
