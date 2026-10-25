import { describe, expect, it } from "vitest";
import {
  assessRequestCompleteness,
  completenessUserHint,
  hasAnyProductHint,
  hasValidOrderQuantity,
  normalizeDraftProducts,
} from "./request-completeness";

describe("assessRequestCompleteness", () => {
  it("marks incomplete when only symbol without supplier", () => {
    expect(
      assessRequestCompleteness({ symbol: "ABC-1", product: "", supplierId: "" })
    ).toBe("incomplete");
  });

  it("marks incomplete when only product without supplier", () => {
    expect(
      assessRequestCompleteness({ product: "Wkręt M6", supplierId: "" })
    ).toBe("incomplete");
  });

  it("marks incomplete without quantity for zamowienie", () => {
    expect(
      assessRequestCompleteness({
        symbol: "ABC-1",
        supplierId: "sup-1",
        requestKind: "zamowienie",
      })
    ).toBe("incomplete");
    expect(hasValidOrderQuantity("", "zamowienie")).toBe(false);
    expect(hasValidOrderQuantity("2", "zamowienie")).toBe(true);
  });

  it("marks complete with supplier, product and quantity", () => {
    expect(
      assessRequestCompleteness({
        product: "Wkręt M6",
        supplierId: "sup-1",
        quantity: "3",
        requestKind: "zamowienie",
      })
    ).toBe("complete");
  });

  it("marks complete with supplier and symbol when quantity given", () => {
    expect(
      assessRequestCompleteness({
        symbol: "ABC-1",
        supplierId: "sup-1",
        quantity: "1",
        requestKind: "zamowienie",
      })
    ).toBe("complete");
  });

  it("does not accept quantity dash for zamowienie", () => {
    expect(hasValidOrderQuantity("-", "zamowienie")).toBe(false);
    expect(
      assessRequestCompleteness({
        product: "HD TriVest Plunger",
        supplierId: "sup-1",
        quantity: "-",
        requestKind: "zamowienie",
      })
    ).toBe("incomplete");
  });

  it("does not require quantity for informacja", () => {
    expect(
      assessRequestCompleteness({
        product: "Wkręt M6",
        supplierId: "sup-1",
        requestKind: "informacja",
      })
    ).toBe("complete");
  });

  it("marks incomplete without product hint", () => {
    expect(assessRequestCompleteness({ supplierId: "sup-1" })).toBe("incomplete");
    expect(hasAnyProductHint({ supplierId: "sup-1" })).toBe(false);
    expect(hasAnyProductHint({ mikranCode: "896" })).toBe(true);
  });
});

describe("completenessUserHint", () => {
  it("wymienia tylko brakujące pola (zakupy)", () => {
    const hint = completenessUserHint(
      "incomplete",
      "zamowienie",
      {
        supplierId: "",
        product: "Aplodent Cold",
        quantity: "1",
      },
      { audience: "procurement" }
    );
    expect(hint.detail).toBe("Wybierz dostawcę.");
    expect(hint.detail).not.toContain("produkt");
  });
});

describe("normalizeDraftProducts", () => {
  it("uses symbol as products when product empty", () => {
    expect(normalizeDraftProducts({ symbol: "X-1" })).toEqual({
      products: "X-1",
      symbol: "X-1",
    });
  });
});

describe("symbol z pierwszej litery wpisu (artefakt formularza)", () => {
  it("rozpoznaje sam początek pierwszego słowa nazwy, nie symbol przed spacją", async () => {
    const { isSymbolNamePrefixArtifact, effectiveRequestSymbol } = await import("./request-completeness");
    expect(isSymbolNamePrefixArtifact("S", "Silikon wyciskowy")).toBe(true);
    expect(isSymbolNamePrefixArtifact("B", "Bredent nożyk 36001150")).toBe(true);
    expect(isSymbolNamePrefixArtifact("ABC", "ABC opis")).toBe(false);
    expect(isSymbolNamePrefixArtifact("SR6", "Śruba M6")).toBe(false);
    expect(isSymbolNamePrefixArtifact("S", "S")).toBe(false);
    expect(isSymbolNamePrefixArtifact("-", "Silikon")).toBe(false);
    // Towar wybrany z Subiekta: symbol prawdziwy, nawet gdy nazwa zaczyna się od niego („M” → „Miyo …”).
    expect(effectiveRequestSymbol({ symbol: "M", products: "Miyo trans sunflower", subiektTwId: 987 })).toBe("M");
    expect(effectiveRequestSymbol({ symbol: "S", products: "Silikon", subiektTwId: null })).toBeNull();
    expect(effectiveRequestSymbol({ symbol: "ABC", products: "ABC opis" })).toBe("ABC");
  });

  it("zapis prośby bez towaru z Subiekta nie zachowuje artefaktu", async () => {
    const { normalizeDraftProducts } = await import("./request-completeness");
    expect(normalizeDraftProducts({ symbol: "S", product: "Silikon wyciskowy" })).toEqual({
      products: "Silikon wyciskowy",
      symbol: "-",
    });
    expect(normalizeDraftProducts({ symbol: "M", product: "Miyo trans sunflower", subiektTwId: 987 })).toEqual({
      products: "Miyo trans sunflower",
      symbol: "M",
    });
    expect(normalizeDraftProducts({ symbol: "ABC", product: "ABC opis" })).toEqual({ products: "ABC opis", symbol: "ABC" });
  });
});
