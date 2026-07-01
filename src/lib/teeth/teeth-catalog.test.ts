import { describe, it, expect } from "vitest";
import {
  hasMouldsForKind,
  teethColorsFor,
  toothMouldsFor,
  isTeethDetailComplete,
  isTeethGroupComplete,
  allTeethGroupsComplete,
  formatTeethGroupLabel,
  createTeethGroupDraft,
  teethManufacturerLabel,
  teethProductLineLabel,
  authoritativeTeethProductLine,
  detectTeethProductLine,
  resolveTeethCatalogFromDraft,
  manufacturerForProductLine,
  shouldClearTeethDetailsOnCatalogSync,
  type TeethCatalogRef,
} from "@/lib/teeth/teeth-catalog";

const wiedentEstetic: TeethCatalogRef = { productLine: "wiedent_estetic" };
const ivoclarVivodent: TeethCatalogRef = { productLine: "ivoclar_vivodent_dcl" };
const majorSuperLux: TeethCatalogRef = { productLine: "major_super_lux" };
const hansen: TeethCatalogRef = { productLine: "hansen_generic" };

describe("teeth-catalog", () => {
  describe("manufacturer and product line helpers", () => {
    it("returns label for known manufacturer", () => {
      expect(teethManufacturerLabel("ivoclar")).toBe("Ivoclar");
      expect(teethManufacturerLabel("schottlander")).toBe("Schottlander");
    });

    it("returns product line label", () => {
      expect(teethProductLineLabel("wiedent_classic")).toBe("Wiedent Classic");
      expect(teethProductLineLabel("major_super_lux")).toBe("Major Super Lux");
    });

    it("detects product line from product name", () => {
      expect(detectTeethProductLine("Wiedent zęby Classic przody")).toBe("wiedent_classic");
      expect(detectTeethProductLine("Wiedent Vita zęby przody")).toBe("wiedent_estetic_vita");
      expect(detectTeethProductLine("Wiedent Estetic wg Vity boczne")).toBe("wiedent_estetic_vita");
      expect(detectTeethProductLine("Wiedent Estetic skala W przody")).toBe("wiedent_estetic");
      expect(detectTeethProductLine("Phonares Typ II zęby przednie")).toBe("ivoclar_phonares_ii");
      expect(detectTeethProductLine("Zęby przednie Major Super Lux")).toBe("major_super_lux");
      expect(detectTeethProductLine("Zęby Dentex/AmberLux boczne")).toBe("dentex_amberlux");
    });

    it("Vita line uses VITA palette, not Wiedent W scale", () => {
      const vita: TeethCatalogRef = { productLine: "wiedent_estetic_vita" };
      expect(teethColorsFor(vita)).toContain("A1");
      expect(teethColorsFor(vita)).not.toContain("G1");
      expect(teethColorsFor(wiedentEstetic)).toContain("G1");
    });

    it("prefers Vita line from product name over stale admin estetic mapping", () => {
      expect(
        authoritativeTeethProductLine({
          adminProductLine: "wiedent_estetic",
          product: "Wiedent Vita zęby przody",
          teethManufacturer: "wiedent",
        }),
      ).toBe("wiedent_estetic_vita");
    });

    it("admin product line overrides ambiguous product name", () => {
      const catalog = resolveTeethCatalogFromDraft({
        adminProductLine: "ivoclar_phonares_ii",
        teethManufacturer: "ivoclar",
        product: "Zęby przednie",
      });
      expect(catalog?.productLine).toBe("ivoclar_phonares_ii");
    });

    it("product name wins over stale frozen line from UI", () => {
      const catalog = resolveTeethCatalogFromDraft({
        teethProductLine: "wiedent_classic",
        teethManufacturer: "ivoclar",
        product: "Phonares Typ II zęby przednie",
      });
      expect(catalog?.productLine).toBe("ivoclar_phonares_ii");
    });

    it("authoritativeTeethProductLine prefers admin mapping", () => {
      expect(
        authoritativeTeethProductLine({
          adminProductLine: "major_super_lux",
          product: "Zęby syntetyczne",
          teethManufacturer: "major",
        }),
      ).toBe("major_super_lux");
    });

    it("manufacturerForProductLine maps correctly", () => {
      expect(manufacturerForProductLine("schottlander_enigmalife")).toBe("schottlander");
    });
  });

  describe("palette helpers", () => {
    it("returns colors for product line catalog", () => {
      expect(teethColorsFor(wiedentEstetic)).toContain("A1");
      expect(teethColorsFor(wiedentEstetic)).toContain("G1");
      expect(teethColorsFor({ productLine: "wiedent_classic" })).toContain("D3");
      expect(teethColorsFor({ productLine: "wiedent_classic" })).not.toContain("B1");
    });

    it("hasMouldsForKind per line", () => {
      expect(hasMouldsForKind(ivoclarVivodent, "anterior")).toBe(true);
      expect(hasMouldsForKind({ productLine: "ivoclar_phonares_ii" }, "posterior")).toBe(true);
      expect(hasMouldsForKind(hansen, "anterior")).toBe(false);
    });

    it("toothMouldsFor returns Major Super Lux fason 56", () => {
      expect(toothMouldsFor(majorSuperLux, "anterior")).toContain("56");
    });

    it("Phonares anterior uses S/B/L codes not A11", () => {
      const phonares: TeethCatalogRef = { productLine: "ivoclar_phonares_ii" };
      expect(toothMouldsFor(phonares, "anterior")).toContain("S61");
      expect(toothMouldsFor(phonares, "anterior")).not.toContain("A11");
    });
  });

  describe("isTeethDetailComplete", () => {
    it("requires color, jaw, kind", () => {
      expect(isTeethDetailComplete({ position: 1, color: "", jaw: "upper", kind: "anterior" }, wiedentEstetic)).toBe(false);
      expect(isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: null, kind: "anterior" }, wiedentEstetic)).toBe(false);
      expect(isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: "upper", kind: null }, wiedentEstetic)).toBe(false);
    });

    it("requires mould for wiedent estetic anterior", () => {
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", mould: null, jaw: "upper", kind: "anterior" }, wiedentEstetic),
      ).toBe(false);
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", mould: "12", jaw: "upper", kind: "anterior" }, wiedentEstetic),
      ).toBe(true);
    });

    it("does not require mould for hansen", () => {
      expect(
        isTeethDetailComplete({ position: 1, color: "A1", jaw: "upper", kind: "anterior" }, hansen),
      ).toBe(true);
    });
  });

  describe("teeth group builder", () => {
    it("formatTeethGroupLabel renders Major Super Lux example", () => {
      expect(
        formatTeethGroupLabel({
          color: "A2",
          mould: "56",
          jaw: "upper",
          kind: "anterior",
          count: 4,
        }),
      ).toBe("A2 · 56 · góra · przednie × 4 szt.");
    });

    it("isTeethGroupComplete validates group spec", () => {
      const ok = createTeethGroupDraft({
        color: "A1",
        mould: "12",
        jaw: "upper",
        kind: "anterior",
        count: 3,
      });
      expect(isTeethGroupComplete(ok, wiedentEstetic)).toBe(true);
      expect(allTeethGroupsComplete([ok], wiedentEstetic)).toBe(true);
    });
  });

  describe("shouldClearTeethDetailsOnCatalogSync", () => {
    it("does not clear when product line is first resolved from null", () => {
      expect(
        shouldClearTeethDetailsOnCatalogSync(null, "wiedent_estetic"),
      ).toBe(false);
      expect(
        shouldClearTeethDetailsOnCatalogSync(undefined, "wiedent_estetic"),
      ).toBe(false);
    });

    it("clears when user had a different line set", () => {
      expect(
        shouldClearTeethDetailsOnCatalogSync("ivoclar_vivodent_dcl", "wiedent_estetic"),
      ).toBe(true);
    });
  });
});
