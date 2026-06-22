import { describe, expect, it } from "vitest";
import {
  formatProductZdLookupAppOrderHint,
  productZdLookupAppOrderHint,
  productZdLookupSupplierName,
} from "@/lib/orders/product-zd-lookup-ui";

describe("productZdLookupSupplierName", () => {
  it("zwraca dostawcę dla found i no_match", () => {
    expect(
      productZdLookupSupplierName({
        status: "found",
        supplierId: "s1",
        supplierName: "Renfert",
        matches: [],
      })
    ).toBe("Renfert");
    expect(
      productZdLookupSupplierName({
        status: "no_match",
        supplierId: "s1",
        supplierName: "Chifa",
      })
    ).toBe("Chifa");
    expect(
      productZdLookupSupplierName({
        status: "no_match",
        supplierId: null,
        supplierName: null,
      })
    ).toBeNull();
    expect(
      productZdLookupSupplierName({
        status: "offline",
        message: "offline",
      })
    ).toBeNull();
  });
});

describe("productZdLookupAppOrderHint", () => {
  it("zwraca hint tylko dla no_match z appOrderHint", () => {
    const hint = {
      orderId: "o1",
      orderedAt: "2026-05-12T10:00:00.000Z",
      orderType: "Glowne" as const,
      estimatedDeadline: "2026-06-20",
      estimateLabel: "ok. 20.06.2026 · ~30 dni rob.",
      lowConfidence: false,
    };
    expect(
      productZdLookupAppOrderHint({
        status: "no_match",
        supplierId: "s1",
        supplierName: "Chifa",
        appOrderHint: hint,
      })
    ).toEqual(hint);
    expect(
      productZdLookupAppOrderHint({
        status: "found",
        supplierId: "s1",
        supplierName: "Chifa",
        matches: [],
      })
    ).toBeNull();
  });

  it("formatuje etykietę szacunku z datą zamówienia", () => {
    expect(
      formatProductZdLookupAppOrderHint({
        orderId: "o1",
        orderedAt: "2026-05-12",
        orderType: "Glowne",
        estimatedDeadline: "2026-06-20",
        estimateLabel: "ok. 20.06.2026 · ~30 dni rob.",
        lowConfidence: false,
      })
    ).toContain("Zamówiono 12.05.2026");
    expect(
      formatProductZdLookupAppOrderHint({
        orderId: "o1",
        orderedAt: "2026-05-12",
        orderType: "Glowne",
        estimatedDeadline: "2026-06-20",
        estimateLabel: "ok. 20.06.2026 · ~30 dni rob.",
        lowConfidence: false,
      })
    ).toContain("30 dni rob.");
  });
});
