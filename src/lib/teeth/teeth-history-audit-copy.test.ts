import { describe, expect, it } from "vitest";
import { teethOrderHistorySummary } from "./teeth-history-audit-copy";

describe("teeth-history-audit-copy", () => {
  it("buduje etykiety operacji", () => {
    expect(teethOrderHistorySummary("ordered", 3)).toBe(
      "Oznaczono zamówione u dostawcy · 3 pozycje"
    );
    expect(
      teethOrderHistorySummary("delivery_override", 1, { deliveryDate: "2026-07-15" })
    ).toBe("Ustawiono datę dostawy → 2026-07-15 · 1 pozycja");
  });
});
