import { describe, expect, it } from "vitest";
import {
  buildProductPickFromSubiekt,
  looksLikeProductSymbol,
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

describe("productSearchParams", () => {
  it("używa name dla nazwy", () => {
    expect(productSearchParams("wkręt M6")).toEqual({
      search: "wkręt M6",
      name: "wkręt M6",
      pageSize: 12,
      page: 1,
    });
  });

  it("używa symbol dla kodu", () => {
    expect(productSearchParams("ABC")).toMatchObject({ symbol: "ABC", search: "ABC" });
  });
});

describe("buildProductPickFromSubiekt", () => {
  it("informacja — bez ilości", () => {
    const pick = buildProductPickFromSubiekt(
      { tw_Id: 1, tw_Symbol: "X1", tw_Nazwa: "Śruba" },
      "informacja",
      "5"
    );
    expect(pick.quantity).toBe("");
    expect(pick.product).toBe("Śruba");
    expect(pick.symbol).toBe("X1");
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
  });

  it("zamówienie — zachowuje poprawną ilość", () => {
    const pick = buildProductPickFromSubiekt(
      { tw_Id: 1, tw_Symbol: "A", tw_Nazwa: "B" },
      "zamowienie",
      "3"
    );
    expect(pick.quantity).toBe("3");
  });
});
