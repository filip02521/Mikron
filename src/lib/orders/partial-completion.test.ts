import { describe, expect, it } from "vitest";
import { completesPartialDelivery } from "./partial-completion";

describe("completesPartialDelivery", () => {
  it("tylko przejście częściowa → pełna", () => {
    expect(completesPartialDelivery("Czesciowo_zrealizowane", "Zrealizowane")).toBe(true);
    expect(completesPartialDelivery("Czesciowo_zrealizowane", "Czesciowo_zrealizowane")).toBe(false);
    expect(completesPartialDelivery("Zrealizowane", "Zrealizowane")).toBe(false);
    expect(completesPartialDelivery("Zamowione", "Zrealizowane")).toBe(false);
  });
});
