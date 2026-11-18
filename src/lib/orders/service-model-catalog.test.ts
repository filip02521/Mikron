import { describe, expect, it } from "vitest";
import { buildModelCatalog, catalogGroup, catalogMatches, clampCatalogQty, sortCatalog, type CatalogPart } from "./service-model-catalog";

// Dane wymyślone: dwa mikrosilniki i lampa.
const part = (modelTwId: number, partTwId: number, partSymbol: string): CatalogPart => ({
  modelTwId,
  modelSymbol: "SIL-100",
  modelName: "Mikrosilnik Alfa 100",
  partTwId,
  partSymbol,
  partName: `Część ${partSymbol}`,
  defaultQty: 1,
});

describe("buildModelCatalog", () => {
  const models = buildModelCatalog(
    [part(1, 10, "SZCZ-1"), part(1, 11, "LOZ-2")],
    [
      { modelTwId: 1, modelSymbol: "SIL-100", modelName: "Mikrosilnik Alfa 100", months: 36 },
      { modelTwId: 3, modelSymbol: "LAM-7", modelName: "Lampa Beta", months: 24 },
    ],
    [
      { twId: 1, symbol: "SIL-100", name: "Mikrosilnik Alfa 100 -- WYCOFANY", orders: 4 },
      { twId: 2, symbol: "SIL-200", name: "Mikrosilnik Gamma 200", orders: 0 },
      { twId: 3, symbol: "LAM-7", name: "Lampa Beta", orders: 2 },
    ]
  );
  const byId = new Map(models.map((m) => [m.twId, m]));

  it("jeden wpis na model: części, gwarancja i zlecenia razem; nazwa z katalogu wygrywa", () => {
    expect(models).toHaveLength(3);
    const a = byId.get(1)!;
    expect(a.parts.map((p) => p.partSymbol)).toEqual(["SZCZ-1", "LOZ-2"]);
    expect(a.months).toBe(36);
    expect(a.customMonths).toBe(true);
    expect(a.orders).toBe(4);
    expect(a.name).toBe("Mikrosilnik Alfa 100");
  });

  it("model znany tylko z decyzji ma domyślną gwarancję; zapisane 24 mies. to nie jest okres własny", () => {
    expect(byId.get(2)).toMatchObject({ months: 24, customMonths: false, parts: [], orders: 0 });
    expect(byId.get(3)).toMatchObject({ months: 24, customMonths: false });
  });

  it("grupa po częściach; bez części najpierw najczęściej naprawiane", () => {
    expect(catalogGroup(byId.get(1)!)).toBe("z_czesciami");
    expect(catalogGroup(byId.get(2)!)).toBe("bez_czesci");
    const bez = models.filter((m) => catalogGroup(m) === "bez_czesci");
    expect(sortCatalog(bez, "bez_czesci").map((m) => m.twId)).toEqual([3, 2]);
  });

  it("szukanie po nazwie, symbolu modelu i symbolu części; każde słowo musi pasować", () => {
    const a = byId.get(1)!;
    expect(catalogMatches(a, "alfa")).toBe(true);
    expect(catalogMatches(a, "sil-100")).toBe(true);
    expect(catalogMatches(a, "loz-2")).toBe(true);
    expect(catalogMatches(a, "alfa  gamma")).toBe(false);
    expect(catalogMatches(a, "  ")).toBe(true);
  });
});

describe("clampCatalogQty", () => {
  it("1–999, liczby całkowite", () => {
    expect(clampCatalogQty(0)).toBe(1);
    expect(clampCatalogQty(1000)).toBe(999);
    expect(clampCatalogQty(2.6)).toBe(3);
    expect(clampCatalogQty(Number.NaN)).toBe(1);
  });
});
