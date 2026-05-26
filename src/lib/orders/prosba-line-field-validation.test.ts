import { describe, expect, it } from "vitest";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  assessProsbaLineFields,
  shouldShowProsbaLineFieldValidation,
} from "./prosba-line-field-validation";

const baseLine: ProductLineDraft = {
  id: "a",
  symbol: "",
  mikranCode: "",
  product: "",
  quantity: "",
};

describe("shouldShowProsbaLineFieldValidation", () => {
  it("nie pokazuje na pustej pierwszej pozycji bez próby wysłania", () => {
    expect(
      shouldShowProsbaLineFieldValidation(baseLine, {
        active: true,
        validationAttempted: false,
        lineCount: 1,
      })
    ).toBe(false);
  });

  it("pokazuje po próbie wysłania pustego formularza", () => {
    expect(
      shouldShowProsbaLineFieldValidation(baseLine, {
        active: true,
        validationAttempted: true,
        lineCount: 1,
      })
    ).toBe(true);
  });

  it("pokazuje na aktywnej pozycji po rozpoczęciu wpisywania", () => {
    expect(
      shouldShowProsbaLineFieldValidation(
        { ...baseLine, symbol: "A" },
        { active: true, validationAttempted: false, lineCount: 1 }
      )
    ).toBe(true);
  });
});

describe("assessProsbaLineFields", () => {
  it("oznacza brak produktu jako błąd w trybie strict", () => {
    const fields = assessProsbaLineFields(baseLine, "zamowienie", "strict");
    expect(fields.symbol.state).toBe("error");
    expect(fields.product.message).toContain("symbol");
  });

  it("oznacza brak ilości przy zamówieniu", () => {
    const fields = assessProsbaLineFields(
      { ...baseLine, product: "Wkręt", subiektTwId: 1 },
      "zamowienie",
      "strict"
    );
    expect(fields.quantity.state).toBe("error");
    expect(fields.quantity.message).toContain("ilość");
  });

  it("nie wymaga ilości przy informacji", () => {
    const fields = assessProsbaLineFields(
      { ...baseLine, product: "Towar" },
      "informacja",
      "strict"
    );
    expect(fields.quantity.state).toBe("default");
  });
});
