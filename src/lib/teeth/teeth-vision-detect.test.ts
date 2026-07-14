import { describe, expect, it } from "vitest";
import { TEETH_LINE_DEFINITIONS } from "@/lib/teeth/teeth-lines-data";

describe("teeth-vision-detect prompt", () => {
  it("TEETH_LINE_DEFINITIONS zawiera wszystkie linie produktów", () => {
    expect(TEETH_LINE_DEFINITIONS.length).toBeGreaterThanOrEqual(18);
  });

  it("każda linia ma id, label, colors, moulds", () => {
    for (const def of TEETH_LINE_DEFINITIONS) {
      expect(def.id).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.colors.length).toBeGreaterThan(0);
      expect(def.moulds).toBeDefined();
    }
  });

  it("linie generyczne (hansen/mgm/formed) nie mają fasonów", () => {
    for (const id of ["hansen_generic", "mgm_generic", "formed_generic"] as const) {
      const def = TEETH_LINE_DEFINITIONS.find((d) => d.id === id);
      expect(def).toBeDefined();
      expect(def!.moulds.anterior == null || def!.moulds.anterior.length === 0).toBe(true);
      expect(def!.moulds.posterior == null || def!.moulds.posterior.length === 0).toBe(true);
    }
  });

  it("pary Ivostar/Gnathostar mają wspólne kolory", () => {
    const ivostar = TEETH_LINE_DEFINITIONS.find((d) => d.id === "ivoclar_ivostar");
    const gnathostar = TEETH_LINE_DEFINITIONS.find((d) => d.id === "ivoclar_gnathostar");
    expect(ivostar).toBeDefined();
    expect(gnathostar).toBeDefined();
    expect(ivostar!.colors).toEqual(gnathostar!.colors);
  });

  it("pary Vivodent/Orthotyp mają wspólne kolory", () => {
    const vivodent = TEETH_LINE_DEFINITIONS.find((d) => d.id === "ivoclar_vivodent_dcl");
    const orthotyp = TEETH_LINE_DEFINITIONS.find((d) => d.id === "ivoclar_orthotyp_dcl");
    expect(vivodent).toBeDefined();
    expect(orthotyp).toBeDefined();
    expect(vivodent!.colors).toEqual(orthotyp!.colors);
  });

  it("Wiedent Estetic i Estetic Vita mają te same fasony", () => {
    const estetic = TEETH_LINE_DEFINITIONS.find((d) => d.id === "wiedent_estetic");
    const esteticVita = TEETH_LINE_DEFINITIONS.find((d) => d.id === "wiedent_estetic_vita");
    expect(estetic).toBeDefined();
    expect(esteticVita).toBeDefined();
    expect(estetic!.moulds).toEqual(esteticVita!.moulds);
  });

  it("Dentex AmberLux i AmberLux V mają te same fasony", () => {
    const amberlux = TEETH_LINE_DEFINITIONS.find((d) => d.id === "dentex_amberlux");
    const amberluxV = TEETH_LINE_DEFINITIONS.find((d) => d.id === "dentex_amberlux_v");
    expect(amberlux).toBeDefined();
    expect(amberluxV).toBeDefined();
    expect(amberlux!.moulds).toEqual(amberluxV!.moulds);
  });
});
