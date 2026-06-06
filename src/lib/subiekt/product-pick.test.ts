import { describe, expect, it } from "vitest";
import {
  buildProductPickFromSubiekt,
  combinedProductSearchDisplay,
  combinedProductSymbolPreview,
  formatSubiektProductOption,
  inferCombinedProductSearchField,
  looksLikeProductSymbol,
  minProductSearchLength,
  mergeSubiektProductSearchResults,
  patchFromCombinedProductInput,
  productSearchParams,
  productSuggestSearchField,
} from "./product-pick";

describe("productSuggestSearchField", () => {
  it("używa combined dla scalonego pola produktu", () => {
    expect(productSuggestSearchField("name")).toBe("combined");
    expect(productSuggestSearchField("symbol")).toBe("combined");
    expect(productSuggestSearchField("plu")).toBe("plu");
  });
});

describe("mergeSubiektProductSearchResults", () => {
  it("łączy wyniki bez duplikatów tw_Id, zachowując kolejność batchy", () => {
    const merged = mergeSubiektProductSearchResults([
      [{ tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "Alpha" }],
      [
        { tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "Alpha" },
        { tw_Id: 2, tw_Symbol: "B", tw_Nazwa: "Beta" },
      ],
    ]);
    expect(merged.map((p) => p.tw_Id)).toEqual([1, 2]);
  });

  it("ogranicza do limitu", () => {
    const merged = mergeSubiektProductSearchResults(
      [[{ tw_Id: 1 }, { tw_Id: 2 }, { tw_Id: 3 }]],
      2
    );
    expect(merged).toHaveLength(2);
  });
});

describe("combined product search", () => {
  it("inferuje symbol vs nazwę", () => {
    expect(inferCombinedProductSearchField("ABC-12")).toBe("symbol");
    expect(inferCombinedProductSearchField("ABC")).toBe("symbol");
    expect(inferCombinedProductSearchField("wkręt M6")).toBe("name");
    expect(inferCombinedProductSearchField("wkręt")).toBe("name");
  });

  it("wyświetla nazwę przed symbolem", () => {
    expect(
      combinedProductSearchDisplay({ symbol: "X1", product: "Śruba" })
    ).toBe("Śruba");
    expect(
      combinedProductSearchDisplay({ symbol: "X1", product: "" })
    ).toBe("X1");
  });

  it("podgląd symbolu tylko gdy nazwa w polu", () => {
    expect(
      combinedProductSymbolPreview({ symbol: "X1", product: "Śruba" })
    ).toBe("X1");
    expect(
      combinedProductSymbolPreview({ symbol: "X1", product: "" })
    ).toBeNull();
    expect(
      combinedProductSymbolPreview({ symbol: "-", product: "Tylko nazwa" })
    ).toBeNull();
  });

  it("patch zapisuje w odpowiednim polu", () => {
    expect(patchFromCombinedProductInput("ABC")).toEqual({
      symbol: "ABC",
      product: "",
    });
    expect(patchFromCombinedProductInput("wkręt")).toEqual({
      product: "wkręt",
      symbol: "",
    });
  });

  it("edycja nazwy po wyborze z Subiekta nie kasuje symbolu", () => {
    expect(
      patchFromCombinedProductInput("Śruba M6 x", {
        symbol: "SR6",
        product: "Śruba M6",
      })
    ).toEqual({ product: "Śruba M6 x", symbol: "SR6" });
  });

  it("przejście z symbolu na nazwę zachowuje symbol przy rozszerzeniu", () => {
    expect(
      patchFromCombinedProductInput("ABC opis", {
        symbol: "ABC",
        product: "",
      })
    ).toEqual({ product: "ABC opis", symbol: "ABC" });
  });

  it("rozpoznaje wklejkę SYMBOL — Nazwa z Subiekta", () => {
    expect(patchFromCombinedProductInput("SR6 — Śruba M6")).toEqual({
      symbol: "SR6",
      product: "Śruba M6",
    });
  });
});

describe("looksLikeProductSymbol", () => {
  it("akceptuje krótki kod", () => {
    expect(looksLikeProductSymbol("ABC-12")).toBe(true);
  });

  it("odrzuca frazę z spacją (nazwa)", () => {
    expect(looksLikeProductSymbol("wkręt M6")).toBe(false);
  });
});

describe("minProductSearchLength", () => {
  it("PLU wymaga jednego znaku", () => {
    expect(minProductSearchLength("plu")).toBe(1);
  });

  it("symbol i nazwa wymagają dwóch znaków", () => {
    expect(minProductSearchLength("symbol")).toBe(2);
    expect(minProductSearchLength("name")).toBe(2);
  });
});

describe("productSearchParams", () => {
  it("używa name dla nazwy", () => {
    expect(productSearchParams("wkręt M6", "name")).toEqual({
      search: "wkręt M6",
      name: "wkręt M6",
      pageSize: 12,
      page: 1,
    });
  });

  it("używa symbol dla kodu", () => {
    expect(productSearchParams("ABC", "symbol")).toMatchObject({
      symbol: "ABC",
      search: "ABC",
    });
  });

  it("używa plu dla kodu Mikran", () => {
    expect(productSearchParams("896", "plu")).toEqual({
      search: "896",
      plu: "896",
      pageSize: 12,
      page: 1,
    });
  });

  it("auto: symbol dla krótkiego kodu", () => {
    expect(productSearchParams("ABC")).toMatchObject({ symbol: "ABC", search: "ABC" });
  });
});

describe("buildProductPickFromSubiekt", () => {
  it("informacja — bez ilości", () => {
    const pick = buildProductPickFromSubiekt(
      { tw_Id: 1, tw_Symbol: "X1", tw_Nazwa: "Śruba", tw_PLU: "896" },
      "informacja",
      "5"
    );
    expect(pick.quantity).toBe("");
    expect(pick.product).toBe("Śruba");
    expect(pick.symbol).toBe("X1");
    expect(pick.mikranCode).toBe("896");
    expect(pick.subiektTwId).toBe(1);
  });

  it("zamówienie — domyślna ilość 1", () => {
    const pick = buildProductPickFromSubiekt(
      { tw_Id: 1, tw_Nazwa: "Tylko nazwa" },
      "zamowienie"
    );
    expect(pick.quantity).toBe("1");
    expect(pick.symbol).toBe("-");
    expect(pick.product).toBe("Tylko nazwa");
    expect(pick.mikranCode).toBe("");
  });

  it("zamówienie — zachowuje poprawną ilość", () => {
    const pick = buildProductPickFromSubiekt(
      { tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "B", tw_PLU: "1" },
      "zamowienie",
      "3"
    );
    expect(pick.quantity).toBe("3");
    expect(pick.mikranCode).toBe("1");
  });

  it("obsługuje liczbowy tw_PLU (nie wywala trim)", () => {
    const pick = buildProductPickFromSubiekt(
      // @ts-expect-error: Subiekt czasem zwraca PLU jako number
      { tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "B", tw_PLU: 896 },
      "zamowienie"
    );
    expect(pick.mikranCode).toBe("896");

    const opt = formatSubiektProductOption(
      // @ts-expect-error: Subiekt czasem zwraca PLU jako number
      { tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "B", tw_PLU: 896 }
    );
    expect(opt.subtitle).toContain("Kod Mikran: 896");
  });
});
