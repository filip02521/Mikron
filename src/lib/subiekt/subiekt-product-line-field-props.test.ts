import { describe, expect, it } from "vitest";
import { assessProsbaLineFields } from "@/lib/orders/prosba-line-field-validation";
import {
  mergeCombinedProductFieldProps,
  mikranFieldProps,
} from "./subiekt-product-line-field-props";

describe("subiekt-product-line-field-props", () => {
  it("scala błąd produktu na jedno pole", () => {
    const map = assessProsbaLineFields(
      { id: "1", symbol: "", mikranCode: "", product: "", quantity: "" },
      "zamowienie",
      "strict"
    );
    const merged = mergeCombinedProductFieldProps(map);
    expect(merged.state).toBe("error");
    expect(merged.error).toContain("nazwę lub symbol");
    expect(mikranFieldProps(map).state).toBeUndefined();
  });
});
