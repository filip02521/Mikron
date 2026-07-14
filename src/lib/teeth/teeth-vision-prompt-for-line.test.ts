import { describe, expect, it } from "vitest";
import { buildTeethVisionPromptForLine } from "@/lib/teeth/teeth-vision-prompt";
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

describe("buildTeethVisionPromptForLine", () => {
  it("zwraca niepusty prompt dla każdej linii", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt.length, `prompt for ${line} should not be empty`).toBeGreaterThan(500);
    }
  });

  it("zawiera productLine w prompcie", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should contain its id`).toContain(line);
    }
  });

  it("zawiera wzorzec A (nagłówek koloru) dla wszystkich linii", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should contain pattern A`).toContain("**A.");
    }
  });

  it("zawiera wzorzec B (format linii) dla wszystkich linii", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should contain pattern B`).toContain("**B.");
    }
  });

  it("zawiera wzorzec O (cyfry 8 vs 9) dla wszystkich linii", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should contain pattern O`).toContain("**O.");
    }
  });

  it("zawiera wskazówki specyficzne dla linii", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should contain line-specific hints section`).toContain(
        "Wskazówki specyficzne dla tej linii",
      );
    }
  });

  it("zawiera DOKŁADNOŚĆ PRZED SZYBKOŚCIĄ", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should contain accuracy rule`).toContain("DOKŁADNOŚĆ PRZED SZYBKOŚCIĄ");
    }
  });

  it("dla major_super_lux zawiera wzorce C i E", () => {
    const prompt = buildTeethVisionPromptForLine("major_super_lux");
    expect(prompt).toContain("**C.");
    expect(prompt).toContain("**E.");
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

  it("nie zawiera katalogów innych linii", () => {
    const prompt = buildTeethVisionPromptForLine("wiedent_estetic");
    expect(prompt).not.toContain("Phonares");
    expect(prompt).not.toContain("Ivostar");
    expect(prompt).not.toContain("AmberLux");
  });

  it("dla dentex_amberlux zawiera wskazówkę o rzymskich fasonach", () => {
    const prompt = buildTeethVisionPromptForLine("dentex_amberlux");
    expect(prompt).toContain("rzyms");
  });

  it("dla wiedent_estetic zawiera wskazówkę o 08x", () => {
    const prompt = buildTeethVisionPromptForLine("wiedent_estetic");
    expect(prompt).toContain("08x");
  });

  it("zawiera schema odpowiedzi (items, productLine, color, kind, count)", () => {
    for (const line of ALL_LINES) {
      const prompt = buildTeethVisionPromptForLine(line);
      expect(prompt, `${line} should mention items`).toContain("items");
      expect(prompt, `${line} should mention count`).toContain("count");
    }
  });
});
