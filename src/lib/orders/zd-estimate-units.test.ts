import { describe, expect, it } from "vitest";
import {
  normalizeUnitsPerPackage,
  zdDocumentUnitsToPieces,
} from "./zd-estimate-units";

describe("normalizeUnitsPerPackage", () => {
  it("zwraca 1 dla braku / niepoprawnych wartości", () => {
    expect(normalizeUnitsPerPackage(null)).toBe(1);
    expect(normalizeUnitsPerPackage(undefined)).toBe(1);
    expect(normalizeUnitsPerPackage(0)).toBe(1);
    expect(normalizeUnitsPerPackage(-3)).toBe(1);
    expect(normalizeUnitsPerPackage(NaN)).toBe(1);
  });

  it("obcina do liczby całkowitej ≥ 1", () => {
    expect(normalizeUnitsPerPackage(10)).toBe(10);
    expect(normalizeUnitsPerPackage(10.9)).toBe(10);
  });
});

describe("zdDocumentUnitsToPieces", () => {
  it("bez opakowania: 1:1", () => {
    expect(zdDocumentUnitsToPieces(5, 1)).toBe(5);
    expect(zdDocumentUnitsToPieces(5, null)).toBe(5);
  });

  it("z opakowaniem: jednostki ZD × pack", () => {
    expect(zdDocumentUnitsToPieces(2, 10)).toBe(20);
    expect(zdDocumentUnitsToPieces(3, 100)).toBe(300);
  });

  it("ujemne / NaN jednostki → 0", () => {
    expect(zdDocumentUnitsToPieces(-1, 10)).toBe(0);
    expect(zdDocumentUnitsToPieces(NaN, 10)).toBe(0);
  });
});
