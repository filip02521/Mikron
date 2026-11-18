import { describe, expect, it } from "vitest";
import {
  getDeliveryProgress,
  getOrderFulfillmentProgress,
  orderUnit,
  orderUnitGenitive,
  resolveStatusFromDeliveredQuantity,
} from "./individual";

describe("jednostka ilości — zęby w klapkach", () => {
  it("odmienia klapki tylko dla pozycji zębowych", () => {
    expect(orderUnit(3, false)).toBe("szt.");
    expect(orderUnit(1, true)).toBe("klapka");
    expect(orderUnit(3, true)).toBe("klapki");
    expect(orderUnit(5, true)).toBe("klapek");
    expect(orderUnitGenitive(1, true)).toBe("klapki");
    expect(orderUnitGenitive(3, true)).toBe("klapek");
    expect(orderUnitGenitive(3, false)).toBe("szt.");
  });

  it("postęp dostawy zębów liczy klapki", () => {
    expect(getDeliveryProgress("3", "2", true).fractionLabel).toBe("2/3 klapki");
    expect(getDeliveryProgress("3", "2").fractionLabel).toBe("2/3 szt.");
    expect(getOrderFulfillmentProgress("6", "0", "2", true).fractionLabel).toBe(
      "4 z 6 klapek · 2 wycofane"
    );
  });
});

describe("getDeliveryProgress", () => {
  it("pokazuje brakującą ilość przy częściowej dostawie", () => {
    const p = getDeliveryProgress("3", "2");
    expect(p.fractionLabel).toBe("2/3 szt.");
    expect(p.remaining).toBe(1);
  });
});

describe("resolveStatusFromDeliveredQuantity", () => {
  it("ustawia częściowo zrealizowane", () => {
    expect(resolveStatusFromDeliveredQuantity("3", "2")).toBe(
      "Czesciowo_zrealizowane"
    );
  });

  it("ustawia zrealizowane przy pełnej dostawie", () => {
    expect(resolveStatusFromDeliveredQuantity("3", "3")).toBe("Zrealizowane");
  });
});
