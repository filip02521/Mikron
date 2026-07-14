import { describe, expect, it } from "vitest";
import {
  lineSpecificHints,
  selectPatternsForLine,
} from "@/lib/teeth/teeth-vision-line-hints";
import type { TeethProductLine } from "@/lib/teeth/teeth-catalog-types";

const ALL_LINES: TeethProductLine[] = [
  "wiedent_classic",
  "wiedent_almamiss",
  "wiedent_estetic",
  "wiedent_estetic_vita",
  "wiedent_estetic_om",
  "ivoclar_ivostar",
  "ivoclar_gnathostar",
  "ivoclar_phonares_ii",
  "ivoclar_vivodent_dcl",
  "ivoclar_orthotyp_dcl",
  "major_super_lux",
  "major_composite",
  "major_dent",
  "dentex_amberlux",
  "dentex_amberlux_v",
  "schottlander_enigmalife",
  "hansen_generic",
  "mgm_generic",
  "formed_generic",
];

describe("lineSpecificHints", () => {
  it("zwraca niepustą wskazówkę dla każdej z 18 linii", () => {
    for (const line of ALL_LINES) {
      const hint = lineSpecificHints(line);
      expect(hint.length, `hint for ${line} should not be empty`).toBeGreaterThan(100);
    }
  });

  it("zawiera kluczowe elementy w wskazówkach", () => {
    for (const line of ALL_LINES) {
      const hint = lineSpecificHints(line);
      expect(hint, `${line} should mention Kolory:`).toContain("Kolory:");
      expect(hint, `${line} should mention Fasony or mould=null or Przody`).toMatch(/Fasony|mould=null|Przody|Boki/);
    }
  });

  it("Ivostar wspominia o Gnathostar", () => {
    const hint = lineSpecificHints("ivoclar_ivostar");
    expect(hint).toContain("Gnathostar");
  });

  it("Gnathostar wspominia o Ivostar", () => {
    const hint = lineSpecificHints("ivoclar_gnathostar");
    expect(hint).toContain("Ivostar");
  });

  it("Vivodent DCL wspominia o Orthotyp", () => {
    const hint = lineSpecificHints("ivoclar_vivodent_dcl");
    expect(hint).toContain("Orthotyp");
  });

  it("Orthotyp DCL wspominia o Vivodent", () => {
    const hint = lineSpecificHints("ivoclar_orthotyp_dcl");
    expect(hint).toContain("Vivodent");
  });

  it("Phonares II wspominia o Orthotyp (Lingual overlap)", () => {
    const hint = lineSpecificHints("ivoclar_phonares_ii");
    expect(hint).toContain("Orthotyp");
  });

  it("Dentex AmberLux zawiera wskazówkę o rzymskich fasonach", () => {
    const hint = lineSpecificHints("dentex_amberlux");
    expect(hint).toContain("rzyms");
    expect(hint).toContain("mnożnik");
  });

  it("Wiedent Estetic zawiera wskazówkę o 08x", () => {
    const hint = lineSpecificHints("wiedent_estetic");
    expect(hint).toContain("08x");
  });

  it("zawiera uniwersalne wskazówki o skreśleniach", () => {
    for (const line of ALL_LINES) {
      const hint = lineSpecificHints(line);
      expect(hint, `${line} should mention skreśl`).toContain("skreśl");
    }
  });

  it("zawiera uniwersalne wskazówki o spacjach w kodach", () => {
    for (const line of ALL_LINES) {
      const hint = lineSpecificHints(line);
      expect(hint, `${line} should mention spacje`).toContain("spacj");
    }
  });
});

describe("selectPatternsForLine", () => {
  it("zwraca wzorce uniwersalne dla każdej linii", () => {
    for (const line of ALL_LINES) {
      const patterns = selectPatternsForLine(line);
      expect(patterns, `${line} should include A`).toContain("A");
      expect(patterns, `${line} should include B`).toContain("B");
      expect(patterns, `${line} should include O`).toContain("O");
    }
  });

  it("dodaje C i E dla major_super_lux", () => {
    const patterns = selectPatternsForLine("major_super_lux");
    expect(patterns).toContain("C");
    expect(patterns).toContain("E");
  });

  it("dodaje N i P dla ivoclar_ivostar", () => {
    const patterns = selectPatternsForLine("ivoclar_ivostar");
    expect(patterns).toContain("N");
    expect(patterns).toContain("P");
  });

  it("dodaje P (bez N) dla ivoclar_gnathostar", () => {
    const patterns = selectPatternsForLine("ivoclar_gnathostar");
    expect(patterns).toContain("P");
    expect(patterns).not.toContain("N");
  });

  it("nie dodaje N dla innych linii", () => {
    for (const line of ALL_LINES) {
      if (line === "ivoclar_ivostar") continue;
      const patterns = selectPatternsForLine(line);
      expect(patterns, `${line} should not include N`).not.toContain("N");
    }
  });
});
