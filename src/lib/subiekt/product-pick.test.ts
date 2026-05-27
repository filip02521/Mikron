import { describe, expect, it } from "vitest";
import {
  buildProductPickFromSubiekt,
  formatSubiektProductOption,
  looksLikeProductSymbol,
  minProductSearchLength,
  productSearchParams,
} from "./product-pick";

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
