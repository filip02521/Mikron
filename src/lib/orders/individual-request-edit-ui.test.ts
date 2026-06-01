import { describe, expect, it } from "vitest";
import { editInitialFromMyOrderRow } from "./individual-request-edit-ui";
import { testMyOrderLine, testMyOrderRow } from "@/test-utils/fixtures";

function minimalRow(overrides: Partial<Parameters<typeof testMyOrderRow>[0]> = {}) {
  return testMyOrderRow({
    id: "g1",
    lines: [
      testMyOrderLine({
        id: "o1",
        product: "Wkręt",
        symbol: "A1",
        subiektTwId: 42,
        quantity: "2",
        quantityLabel: "2 szt.",
      }),
    ],
    supplierId: "sup-1",
    salesPersonId: "sp-1",
    requestKind: "zamowienie",
    headline: "Test",
    headlineTone: "neutral",
    canEditBySales: true,
    orderIds: ["o1"],
    ...overrides,
  });
}

describe("editInitialFromMyOrderRow", () => {
  it("zachowuje subiektTwId przy edycji prośby handlowca", () => {
    const initial = editInitialFromMyOrderRow(minimalRow());
    expect(initial?.lines[0]?.subiektTwId).toBe(42);
  });
});
