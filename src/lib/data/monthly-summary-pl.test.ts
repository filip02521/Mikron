import { describe, expect, it } from "vitest";
import {
  formatDni,
  formatProsby,
  formatZlozoneProsby,
  polishPlural,
  shortMonthLabel,
  unitProsby,
} from "./monthly-summary-pl";

describe("polishPlural", () => {
  it("odmienia 1 / 2–4 / 5+ oraz 12–14", () => {
    expect(polishPlural(1, "prośba", "prośby", "próśb")).toBe("prośba");
    expect(polishPlural(2, "prośba", "prośby", "próśb")).toBe("prośby");
    expect(polishPlural(4, "prośba", "prośby", "próśb")).toBe("prośby");
    expect(polishPlural(5, "prośba", "prośby", "próśb")).toBe("próśb");
    expect(polishPlural(12, "prośba", "prośby", "próśb")).toBe("próśb");
    expect(polishPlural(22, "prośba", "prośby", "próśb")).toBe("prośby");
    expect(polishPlural(0, "prośba", "prośby", "próśb")).toBe("próśb");
  });
});

describe("formatProsby / formatDni", () => {
  it("składa liczbę ze słowem", () => {
    expect(formatProsby(1)).toBe("1\u00a0prośba");
    expect(formatProsby(3)).toBe("3\u00a0prośby");
    expect(formatDni(1)).toBe("1\u00a0dzień");
    expect(formatDni(5)).toBe("5\u00a0dni");
  });
});

describe("formatZlozoneProsby", () => {
  it("odmienia przymiotnik ze rzeczownikiem", () => {
    expect(formatZlozoneProsby(1)).toBe("1\u00a0złożona prośba");
    expect(formatZlozoneProsby(3)).toBe("3\u00a0złożone prośby");
    expect(formatZlozoneProsby(5)).toBe("5\u00a0złożonych próśb");
  });
});

describe("shortMonthLabel", () => {
  it("skraca nazwy miesięcy po polsku", () => {
    expect(shortMonthLabel("czerwiec 2026")).toBe("cze 2026");
    expect(shortMonthLabel("październik 2025")).toBe("paź 2025");
    expect(shortMonthLabel("maj 2026")).toBe("maj 2026");
  });
});

describe("unitProsby", () => {
  it("zwraca samą formę", () => {
    expect(unitProsby(1)).toBe("prośba");
    expect(unitProsby(7)).toBe("próśb");
  });
});
