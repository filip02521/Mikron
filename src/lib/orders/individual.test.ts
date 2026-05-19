import { describe, expect, it } from "vitest";
import {
  getDeliveryProgress,
  resolveStatusFromDeliveredQuantity,
} from "./individual";

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
