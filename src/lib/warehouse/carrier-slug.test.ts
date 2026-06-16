import { describe, expect, it } from "vitest";
import {
  slugifyWarehouseCarrierLabel,
  uniqueWarehouseCarrierSlug,
} from "./carrier-slug";

describe("slugifyWarehouseCarrierLabel", () => {
  it("normalizuje polskie znaki i spacje", () => {
    expect(slugifyWarehouseCarrierLabel("Kuehne + Nagel")).toBe("kuehne_nagel");
    expect(slugifyWarehouseCarrierLabel("  Poczta Polska  ")).toBe("poczta_polska");
  });

  it("zwraca fallback dla pustej nazwy", () => {
    expect(slugifyWarehouseCarrierLabel("   ")).toBe("kurier");
  });
});

describe("uniqueWarehouseCarrierSlug", () => {
  it("dodaje sufiks gdy slug jest zajęty", () => {
    const taken = new Set(["dpd", "dpd_2"]);
    expect(uniqueWarehouseCarrierSlug("DPD", taken)).toBe("dpd_3");
  });

  it("zachowuje slug przy edycji tego samego wpisu", () => {
    const taken = new Set(["dpd"]);
    expect(uniqueWarehouseCarrierSlug("DPD", taken, "dpd")).toBe("dpd");
  });
});
