import { describe, expect, it } from "vitest";
import { resolveZdEstimateUnitPrices } from "./zd-estimate-unit-prices";

describe("resolveZdEstimateUnitPrices", () => {
  it("para dodana po Policz: cena paczki dzielona przez sztuki z pary", () => {
    // Serwer liczył bez pary (cena paczki = „za sztukę”), w sesji doszła para ×150.
    const out = resolveZdEstimateUnitPrices(
      { 10: 459.99 },
      { 10: 459.99 },
      new Map([[10, { unitsPerPackage: 150, documentUnitMode: "packages" as const }]])
    );
    expect(out[10]).toBeCloseTo(3.0666, 4);
  });

  it("bez opakowania cena ZD jest już za sztukę", () => {
    expect(resolveZdEstimateUnitPrices({ 1: 12.5 }, {}, new Map())[1]).toBe(12.5);
  });

  it("tryb wielokrotności sztuk nie dzieli ceny", () => {
    const out = resolveZdEstimateUnitPrices(
      { 2: 8 },
      {},
      new Map([[2, { unitsPerPackage: 6, documentUnitMode: "pieces_multiple" as const }]])
    );
    expect(out[2]).toBe(8);
  });

  it("starsza sesja bez surowych cen: zostaje cena z serwera", () => {
    expect(resolveZdEstimateUnitPrices(undefined, { 3: 4.2 }, new Map())).toEqual({ 3: 4.2 });
  });
});
