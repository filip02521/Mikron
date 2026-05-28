import { describe, expect, it } from "vitest";
import {
  assertProcurementEntryComplete,
  shouldLinkProcurementCatalogEntry,
} from "@/lib/orders/procurement-submit";

describe("procurement-submit", () => {
  it("wymaga dostawcy i ilości dla zamówienia", () => {
    expect(() =>
      assertProcurementEntryComplete({
        symbol: "ABC",
        product: "Test",
        quantity: "1",
        requestKind: "zamowienie",
        subiektTwId: 100,
      })
    ).toThrow(/dostawcę/i);
  });

  it("link tylko przy tw_Id z Subiekta i dostawcy", () => {
    expect(
      shouldLinkProcurementCatalogEntry({
        subiektTwId: 10,
        supplierId: "sup-1",
        symbol: "A",
        quantity: "1",
        requestKind: "zamowienie",
      })
    ).toBe(true);
    expect(
      shouldLinkProcurementCatalogEntry({
        supplierId: "sup-1",
        symbol: "A",
        quantity: "1",
        requestKind: "zamowienie",
      })
    ).toBe(false);
  });
});
