import { describe, expect, it } from "vitest";
import {
  assessRequestCompleteness,
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
