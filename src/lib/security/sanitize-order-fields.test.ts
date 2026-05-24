import { describe, expect, it } from "vitest";
import { sanitizeOrderDraftFields } from "@/lib/security/sanitize-order-fields";
import { MAX_PRODUCT_TEXT_LEN, MAX_SYMBOL_LEN } from "@/lib/security/text-limits";

describe("sanitizeOrderDraftFields", () => {
  it("truncates long product and symbol", () => {
    const long = "a".repeat(600);
    const out = sanitizeOrderDraftFields({ product: long, symbol: "x".repeat(150) });
    expect(out.product?.length).toBe(MAX_PRODUCT_TEXT_LEN);
    expect(out.symbol?.length).toBe(MAX_SYMBOL_LEN);
  });

  it("leaves undefined fields undefined", () => {
    expect(sanitizeOrderDraftFields({ product: "ok" })).toEqual({ product: "ok" });
  });
});
