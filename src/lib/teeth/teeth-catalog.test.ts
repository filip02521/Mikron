import { describe, it, expect } from "vitest";
import {
  TEETH_COLORS,
  TEETH_MOULDS,
  hasMoulds,
  hasMouldsForKind,
  teethColorsFor,
  teethMouldsFor,
  toothMouldsFor,
  isTeethDetailComplete,
  allTeethDetailsComplete,
  expandTeethDetails,
  groupTeethDetails,
  teethManufacturerLabel,
  parseTeethManufacturer,
  isTeethManufacturer,
  type TeethManufacturer,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";

describe("teeth-catalog", () => {
  describe("manufacturer helpers", () => {
    it("returns label for known manufacturer", () => {
      expect(teethManufacturerLabel("ivoclar")).toBe("Ivoclar");
      expect(teethManufacturerLabel("wiedent")).toBe("Wiedent");
      expect(teethManufacturerLabel("dentex")).toBe("Dentex");
      expect(teethManufacturerLabel("major")).toBe("Major Dental");
      expect(teethManufacturerLabel("hansen")).toBe("Hansen Dental");
      expect(teethManufacturerLabel("mgm")).toBe("MGM System");
      expect(teethManufacturerLabel("formed")).toBe("Formed");
    });

    it("returns null for unknown/null", () => {
      expect(teethManufacturerLabel(null)).toBeNull();
      expect(teethManufacturerLabel(undefined)).toBeNull();
      expect(teethManufacturerLabel("foo" as TeethManufacturer)).toBeNull();
    });

    it("isTeethManufacturer guards correctly", () => {
      expect(isTeethManufacturer("ivoclar")).toBe(true);
      expect(isTeethManufacturer("wiedent")).toBe(true);
      expect(isTeethManufacturer("hansen")).toBe(true);
      expect(isTeethManufacturer("mgm")).toBe(true);
      expect(isTeethManufacturer("formed")).toBe(true);
      expect(isTeethManufacturer("foo")).toBe(false);
      expect(isTeethManufacturer("")).toBe(false);
    });

    it("parseTeethManufacturer parses valid strings", () => {
      expect(parseTeethManufacturer("ivoclar")).toBe("ivoclar");
      expect(parseTeethManufacturer("major")).toBe("major");
      expect(parseTeethManufacturer("hansen")).toBe("hansen");
      expect(parseTeethManufacturer("foo")).toBeNull();
      expect(parseTeethManufacturer(123)).toBeNull();
      expect(parseTeethManufacturer(null)).toBeNull();
    });
  });

  describe("palette helpers", () => {
    it("returns colors for each manufacturer", () => {
      expect(teethColorsFor("ivoclar")).toBe(TEETH_COLORS.ivoclar);
      expect(teethColorsFor("wiedent")).toBe(TEETH_COLORS.wiedent);
      expect(teethColorsFor("dentex")).toBe(TEETH_COLORS.dentex);
      expect(teethColorsFor("major")).toBe(TEETH_COLORS.major);
    });

    it("hasMoulds returns true for all manufacturers with any moulds", () => {
      expect(hasMoulds("ivoclar")).toBe(true);
      expect(hasMoulds("major")).toBe(true);
      expect(hasMoulds("wiedent")).toBe(true);
      expect(hasMoulds("dentex")).toBe(true);
      expect(hasMoulds("hansen")).toBe(false);
      expect(hasMoulds("mgm")).toBe(false);
      expect(hasMoulds("formed")).toBe(false);
    });

    it("hasMouldsForKind distinguishes anterior/posterior", () => {
      expect(hasMouldsForKind("ivoclar", "anterior")).toBe(true);
      expect(hasMouldsForKind("ivoclar", "posterior")).toBe(true);
      expect(hasMouldsForKind("wiedent", "anterior")).toBe(true);
      expect(hasMouldsForKind("wiedent", "posterior")).toBe(true);
      expect(hasMouldsForKind("hansen", "anterior")).toBe(false);
      expect(hasMouldsForKind("hansen", "posterior")).toBe(false);
    });

    it("toothMouldsFor returns correct list for kind", () => {
      expect(toothMouldsFor("ivoclar", "anterior")).toBe(TEETH_MOULDS.ivoclar.anterior);
      expect(toothMouldsFor("wiedent", "anterior").length).toBeGreaterThan(0);
      expect(toothMouldsFor("wiedent", "posterior").length).toBeGreaterThan(0);
      expect(toothMouldsFor("hansen", "anterior")).toEqual([]);
    });

    it("teethMouldsFor (deprecated) returns non-empty for ivoclar/wiedent/dentex/major", () => {
      expect(teethMouldsFor("ivoclar").length).toBeGreaterThan(0);
      expect(teethMouldsFor("wiedent").length).toBeGreaterThan(0);
      expect(teethMouldsFor("dentex").length).toBeGreaterThan(0);
    });
  });

  describe("isTeethDetailComplete", () => {
    it("requires color", () => {
      expect(isTeethDetailComplete({ position: 1, color: "", jaw: "upper", kind: "anterior" }, "wiedent")).toBe(false);
    });

    it("requires jaw", () => {
      expect(isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: null, kind: "anterior" }, "wiedent")).toBe(false);
      expect(isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: undefined, kind: "anterior" }, "wiedent")).toBe(false);
    });

    it("requires kind", () => {
      expect(isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: "upper", kind: null }, "wiedent")).toBe(false);
      expect(isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: "upper", kind: undefined }, "wiedent")).toBe(false);
    });

    it("requires mould for ivoclar anterior", () => {
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", mould: null, jaw: "upper", kind: "anterior" }, "ivoclar"),
      ).toBe(false);
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" }, "ivoclar"),
      ).toBe(true);
    });

    it("requires mould for wiedent anterior", () => {
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", mould: null, jaw: "upper", kind: "anterior" }, "wiedent"),
      ).toBe(false);
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" }, "wiedent"),
      ).toBe(true);
    });

    it("does not require mould for hansen/mgm/formed", () => {
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", jaw: "upper", kind: "anterior" }, "hansen"),
      ).toBe(true);
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", jaw: "lower", kind: "posterior" }, "mgm"),
      ).toBe(true);
    });
  });

  describe("allTeethDetailsComplete", () => {
    it("returns true when manufacturer is null", () => {
      expect(allTeethDetailsComplete([], null, 3)).toBe(true);
      expect(allTeethDetailsComplete(undefined, null, 3)).toBe(true);
    });

    it("returns false when details are missing", () => {
      expect(allTeethDetailsComplete(undefined, "wiedent", 2)).toBe(false);
      expect(allTeethDetailsComplete([], "wiedent", 2)).toBe(false);
      expect(
        allTeethDetailsComplete(
          [{ position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" }],
          "wiedent",
          2,
        ),
      ).toBe(false);
    });

    it("returns true when all details are complete", () => {
      const details: TeethLineDetail[] = [
        { position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" },
        { position: 2, color: "B2", mould: "13", jaw: "upper", kind: "anterior" },
      ];
      expect(allTeethDetailsComplete(details, "wiedent", 2)).toBe(true);
    });

    it("returns false when some details are incomplete", () => {
      const details: TeethLineDetail[] = [
        { position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" },
        { position: 2, color: "", mould: null, jaw: null, kind: null },
      ];
      expect(allTeethDetailsComplete(details, "ivoclar", 2)).toBe(false);
    });
  });

  describe("expandTeethDetails", () => {
    it("creates empty details when undefined", () => {
      const result = expandTeethDetails(undefined, 3);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ position: 1, color: "", mould: null, jaw: null, kind: null });
      expect(result[2]).toEqual({ position: 3, color: "", mould: null, jaw: null, kind: null });
    });

    it("returns details as-is when count matches", () => {
      const details: TeethLineDetail[] = [
        { position: 1, color: "A1" },
        { position: 2, color: "B2" },
      ];
      expect(expandTeethDetails(details, 2)).toBe(details);
    });

    it("trims when details exceed count", () => {
      const details: TeethLineDetail[] = [
        { position: 1, color: "A1" },
        { position: 2, color: "B2" },
        { position: 3, color: "C3" },
      ];
      const result = expandTeethDetails(details, 2);
      expect(result).toHaveLength(2);
      expect(result[0]!.color).toBe("A1");
      expect(result[1]!.color).toBe("B2");
    });

    it("pads when details are fewer than count", () => {
      const details: TeethLineDetail[] = [
        { position: 1, color: "A1" },
      ];
      const result = expandTeethDetails(details, 3);
      expect(result).toHaveLength(3);
      expect(result[0]!.color).toBe("A1");
      expect(result[1]).toEqual({ position: 2, color: "", mould: null, jaw: null, kind: null });
      expect(result[2]).toEqual({ position: 3, color: "", mould: null, jaw: null, kind: null });
    });
  });

  describe("groupTeethDetails", () => {
    it("returns empty for undefined/null", () => {
      expect(groupTeethDetails(undefined)).toEqual([]);
      expect(groupTeethDetails([])).toEqual([]);
    });

    it("groups identical details by color+mould+jaw+kind", () => {
      const details: TeethLineDetail[] = [
        { position: 1, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" },
        { position: 2, color: "A1", mould: "A11", jaw: "upper", kind: "anterior" },
        { position: 3, color: "B2" },
      ];
      const result = groupTeethDetails(details);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ color: "A1", mould: "A11", jaw: "upper", kind: "anterior", count: 2 });
      expect(result[1]).toEqual({ color: "B2", mould: null, jaw: null, kind: null, count: 1 });
    });
  });
});
