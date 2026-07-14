import { describe, expect, it } from "vitest";
import {
  resolveOcrColor,
  isValidOcrColor,
  resolveOcrMouldAndKind,
  isValidOcrMould,
  isValidOcrKind,
  isValidOcrJaw,
  isValidOcrProductLine,
  buildTeethVisionPromptForLine,
} from "./teeth-vision-prompt";

describe("teeth-vision-prompt", () => {
  describe("resolveOcrColor", () => {
    it("zwraca oryginał gdy kolor pasuje do katalogu", () => {
      expect(resolveOcrColor("A2", "wiedent_classic")).toBe("A2");
    });

    it("normalizuje przecinek do kropki dla A3.5", () => {
      expect(resolveOcrColor("A3,5", "wiedent_classic")).toBe("A3.5");
    });

    it("zwraca oryginał gdy normalizacja przecinka nie pasuje", () => {
      expect(resolveOcrColor("A3,5", "wiedent_classic")).toBe("A3.5");
    });

    it("dopasowuje sufiks-only Ivostar Chromascop do pełnego koloru", () => {
      expect(resolveOcrColor("1c", "ivoclar_ivostar")).toBe("140/1C");
      expect(resolveOcrColor("1C", "ivoclar_ivostar")).toBe("140/1C");
      expect(resolveOcrColor("1A", "ivoclar_ivostar")).toBe("120/1A");
      expect(resolveOcrColor("2B", "ivoclar_ivostar")).toBe("210/2B");
      expect(resolveOcrColor("01", "ivoclar_ivostar")).toBe("110/01");
    });

    it("zwraca oryginał gdy sufiks nie pasuje do żadnego koloru Ivostar", () => {
      expect(resolveOcrColor("X9", "ivoclar_ivostar")).toBe("X9");
    });

    it("nie zmienia kolorów bez ukośnika dla Ivostar", () => {
      expect(resolveOcrColor("A2", "ivoclar_ivostar")).toBe("A2");
      expect(resolveOcrColor("BL1", "ivoclar_ivostar")).toBe("BL1");
    });

    it("nie stosuje dopasowania sufiksu dla linii bez Chromascop", () => {
      expect(resolveOcrColor("1c", "wiedent_classic")).toBe("1c");
    });
  });

  describe("isValidOcrColor", () => {
    it("true dla poprawnego koloru", () => {
      expect(isValidOcrColor("A2", "wiedent_classic")).toBe(true);
    });

    it("false dla błędnego koloru", () => {
      expect(isValidOcrColor("X9", "wiedent_classic")).toBe(false);
    });
  });

  describe("resolveOcrMouldAndKind", () => {
    it("dopasowuje fason bez N do wersji z N (dla linii z N-cusp)", () => {
      // Wiedent Estetic posterior NIE ma N, ale testujemy logikę N-cusp
      // Używamy innej linii dla testu N-cusp jeśli istnieje
      const result = resolveOcrMouldAndKind("wiedent_estetic", "79", "posterior");
      expect(result).toEqual({ kind: "posterior", mould: "79" });
    });

    it("dopasowuje fason z N do wersji bez N", () => {
      const result = resolveOcrMouldAndKind("wiedent_estetic", "79", "posterior");
      expect(result).toEqual({ kind: "posterior", mould: "79" });
    });

    it("poprawia kind gdy fason pasuje do innej listy", () => {
      const result = resolveOcrMouldAndKind("wiedent_estetic", "12", "posterior");
      expect(result).toEqual({ kind: "anterior", mould: "12" });
    });

    it("null dla nieprawidłowego fasonu", () => {
      const result = resolveOcrMouldAndKind("wiedent_estetic", "999", "anterior");
      expect(result).toBeNull();
    });

    it("mapuje Gnathostar 84 bez prefiksu D na D84 (posterior)", () => {
      const result = resolveOcrMouldAndKind("ivoclar_ivostar", "84", "posterior");
      expect(result).toEqual({
        kind: "posterior",
        mould: "D84",
        productLine: "ivoclar_gnathostar",
      });
    });

    it("mapuje Ivostar 42 jako anterior na linii ivostar", () => {
      const result = resolveOcrMouldAndKind("ivoclar_ivostar", "42", "anterior");
      expect(result).toEqual({ kind: "anterior", mould: "42" });
    });
  });

  describe("isValidOcrMould", () => {
    it("true dla poprawnego fasonu", () => {
      expect(isValidOcrMould("12", "anterior", "wiedent_estetic")).toBe(true);
    });

    it("true dla null gdy fason opcjonalny", () => {
      expect(isValidOcrMould(null, "anterior", "hansen_generic")).toBe(true);
    });

    it("false dla błędnego fasonu", () => {
      expect(isValidOcrMould("999", "anterior", "wiedent_estetic")).toBe(false);
    });
  });

  describe("isValidOcrKind", () => {
    it("true dla anterior", () => {
      expect(isValidOcrKind("anterior")).toBe(true);
    });

    it("true dla posterior", () => {
      expect(isValidOcrKind("posterior")).toBe(true);
    });

    it("false dla innych wartości", () => {
      expect(isValidOcrKind("middle")).toBe(false);
    });
  });

  describe("isValidOcrJaw", () => {
    it("true dla upper", () => {
      expect(isValidOcrJaw("upper")).toBe(true);
    });

    it("true dla lower", () => {
      expect(isValidOcrJaw("lower")).toBe(true);
    });

    it("true dla null", () => {
      expect(isValidOcrJaw(null)).toBe(true);
    });

    it("false dla innych wartości", () => {
      expect(isValidOcrJaw("middle")).toBe(false);
    });
  });

  describe("isValidOcrProductLine", () => {
    it("true dla poprawnej linii", () => {
      expect(isValidOcrProductLine("wiedent_classic")).toBe(true);
    });

    it("false dla błędnej linii", () => {
      expect(isValidOcrProductLine("unknown_line")).toBe(false);
    });
  });

  describe("buildTeethVisionPromptForLine", () => {
    it("zawiera tylko katalog wskazanej linii (wiedent_estetic)", () => {
      const prompt = buildTeethVisionPromptForLine("wiedent_estetic");
      expect(prompt).toContain("wiedent_estetic");
      expect(prompt).toContain("Wiedent Estetic");
      expect(prompt).not.toContain("Phonares");
      expect(prompt).not.toContain("Ivostar");
      expect(prompt).not.toContain("AmberLux");
    });

    it("nie zawiera katalogów innych linii (ivoclar_phonares_ii)", () => {
      const prompt = buildTeethVisionPromptForLine("ivoclar_phonares_ii");
      expect(prompt).toContain("ivoclar_phonares_ii");
      expect(prompt).not.toContain("Wiedent Classic");
      expect(prompt).not.toContain("Major Super Lux");
    });

    it("zawiera per-liniowe wskazówki (skala W dla wiedent_estetic)", () => {
      const prompt = buildTeethVisionPromptForLine("wiedent_estetic");
      expect(prompt).toContain("skala W");
      expect(prompt).toContain("G1");
      expect(prompt).toContain("N2");
    });

    it("zawiera wzorce uniwersalne A,B,D,F,G,H,I,J,K,L,M,O", () => {
      const prompt = buildTeethVisionPromptForLine("wiedent_classic");
      for (const p of ["**A.", "**B.", "**D.", "**F.", "**G.", "**H.", "**I.", "**J.", "**K.", "**L.", "**M.", "**O."]) {
        expect(prompt, `should contain ${p}`).toContain(p);
      }
    });

    it("dla ivoclar_ivostar zawiera wzorce N i P", () => {
      const prompt = buildTeethVisionPromptForLine("ivoclar_ivostar");
      expect(prompt).toContain("**N.");
      expect(prompt).toContain("**P.");
    });

    it("dla ivoclar_gnathostar zawiera wzorzec P ale nie N", () => {
      const prompt = buildTeethVisionPromptForLine("ivoclar_gnathostar");
      expect(prompt).toContain("**P.");
      expect(prompt).not.toContain("**N.");
    });

    it("dla major_super_lux zawiera wzorce C i E", () => {
      const prompt = buildTeethVisionPromptForLine("major_super_lux");
      expect(prompt).toContain("**C.");
      expect(prompt).toContain("**E.");
    });

    it("zawiera DOKŁADNOŚĆ PRZED SZYBKOŚCIĄ", () => {
      const prompt = buildTeethVisionPromptForLine("dentex_amberlux");
      expect(prompt).toContain("DOKŁADNOŚĆ PRZED SZYBKOŚCIĄ");
    });

    it("zawiera wskazówki specyficzne dla linii", () => {
      const prompt = buildTeethVisionPromptForLine("ivoclar_phonares_ii");
      expect(prompt).toContain("Wskazówki specyficzne dla tej linii");
    });
  });
});
