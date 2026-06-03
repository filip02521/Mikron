import { describe, expect, it } from "vitest";
import {
  formatGlowneMissingIntervalError,
  supplierNamesWithoutOrderInterval,
} from "./glowne-interval-validation";

describe("supplierNamesWithoutOrderInterval", () => {
  it("zwraca dostawców bez interwału", () => {
    expect(
      supplierNamesWithoutOrderInterval([
        { name: "Holtrade", interval_raw: null, interval_weeks: null },
        { name: "OK", interval_raw: "2", interval_weeks: 2 },
      ])
    ).toEqual(["Holtrade"]);
  });

  it("pusty wynik gdy wszyscy mają interwał", () => {
    expect(
      supplierNamesWithoutOrderInterval([
        { name: "A", interval_raw: "4 tyg.", interval_weeks: 4 },
      ])
    ).toEqual([]);
  });
});

describe("formatGlowneMissingIntervalError", () => {
  it("pojedynczy dostawca", () => {
    expect(formatGlowneMissingIntervalError(["Holtrade/Rhein"])).toContain(
      "Holtrade/Rhein"
    );
  });

  it("wielu dostawców", () => {
    const msg = formatGlowneMissingIntervalError(["A", "B"]);
    expect(msg).toContain("A");
    expect(msg).toContain("B");
  });
});
