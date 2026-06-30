import { describe, expect, it } from "vitest";
import {
  assertMinimalTeethDetailsForDb,
  assertTeethLineDetailsComplete,
  normalizeTeethDetailsForSave,
  teethLineDetailsComplete,
} from "./teeth-validation";

describe("teethLineDetailsComplete", () => {
  it("returns true for non-teeth products", () => {
    expect(
      teethLineDetailsComplete({
        teethDetails: null,
        quantity: "1",
        isTeethProduct: false,
      })
    ).toBe(true);
  });

  it("returns false when teeth list is missing", () => {
    expect(
      teethLineDetailsComplete({
        teethDetails: null,
        quantity: "1",
        subiektTwId: 123,
        isTeethProduct: true,
      })
    ).toBe(false);
  });

  it("returns false when jaw is missing", () => {
    expect(
      teethLineDetailsComplete({
        teethDetails: [{ position: 1, color: "A1", mould: "A11", jaw: null, kind: "anterior" }],
        quantity: "1",
        isTeethProduct: true,
      })
    ).toBe(false);
  });

  it("returns false when kind is missing", () => {
    expect(
      teethLineDetailsComplete({
        teethDetails: [{ position: 1, color: "A1", mould: "A11", jaw: "upper", kind: null }],
        quantity: "1",
        isTeethProduct: true,
      })
    ).toBe(false);
  });

  it("returns false when mould is required but missing", () => {
    expect(
      teethLineDetailsComplete({
        teethDetails: [{ position: 1, color: "A1", mould: null, jaw: "upper", kind: "anterior" }],
        quantity: "1",
        adminProductLine: "ivoclar_vivodent_dcl",
        isTeethProduct: true,
      })
    ).toBe(false);
  });

  it("returns true when all fields are complete for ivoclar", () => {
    expect(
      teethLineDetailsComplete({
        teethDetails: [{ position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" }],
        quantity: "1",
        adminProductLine: "ivoclar_vivodent_dcl",
        isTeethProduct: true,
      })
    ).toBe(true);
  });
});

describe("assertMinimalTeethDetailsForDb", () => {
  it("throws when list is empty", () => {
    expect(() => assertMinimalTeethDetailsForDb([])).toThrow(/listę zębów/i);
  });

  it("throws when jaw is missing", () => {
    expect(() =>
      assertMinimalTeethDetailsForDb([
        { position: 1, color: "A1", mould: "A11", jaw: null, kind: "anterior" },
      ])
    ).toThrow(/listę zębów/i);
  });

  it("passes when color, jaw and kind are set", () => {
    expect(() =>
      assertMinimalTeethDetailsForDb([
        { position: 1, color: "A1", mould: null, jaw: "lower", kind: "posterior" },
      ])
    ).not.toThrow();
  });
});

describe("normalizeTeethDetailsForSave", () => {
  it("fills missing kind from admin default", () => {
    expect(
      normalizeTeethDetailsForSave(
        [{ position: 1, color: "A1", mould: "12", jaw: "upper", kind: null }],
        "anterior"
      )
    ).toEqual([{ position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" }]);
  });
});

describe("assertTeethLineDetailsComplete", () => {
  it("throws with label prefix", () => {
    expect(() =>
      assertTeethLineDetailsComplete(
        {
          teethDetails: undefined,
          quantity: "1",
          isTeethProduct: true,
        },
        "Pozycja 2"
      )
    ).toThrow(/Pozycja 2:/);
  });
});
