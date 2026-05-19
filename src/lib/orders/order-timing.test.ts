import { describe, expect, it } from "vitest";
import { canEstimateDeliveryEta, orderPlacementAt } from "./order-timing";

describe("orderPlacementAt", () => {
  it("zwraca ordered_at gdy jest ustawione", () => {
    expect(
      orderPlacementAt({
        ordered_at: "2026-05-10T10:00:00Z",
        action_at: "2026-05-01",
        status: "Zamowione",
      })
    ).toBe("2026-05-10T10:00:00Z");
  });

  it("dla Nowe nie zwraca daty zamówienia", () => {
    expect(
      orderPlacementAt({
        ordered_at: null,
        action_at: "2026-05-01",
        status: "Nowe",
      })
    ).toBeNull();
  });

  it("nie szacuje ETA przed zamówieniem u dostawcy", () => {
    expect(
      canEstimateDeliveryEta({
        ordered_at: null,
        action_at: "2026-05-01",
        status: "Nowe",
      })
    ).toBe(false);
  });
});
