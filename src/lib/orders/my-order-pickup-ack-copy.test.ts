import { describe, expect, it } from "vitest";
import {
  myOrderPickupAckLabel,
  myOrderPickupAckTitle,
} from "./my-order-pickup-ack-copy";

describe("myOrderPickupAckLabel", () => {
  it("jedna pozycja — bez licznika", () => {
    expect(myOrderPickupAckLabel(1)).toBe("Potwierdź odbiór");
    expect(myOrderPickupAckLabel(0)).toBe("Potwierdź odbiór");
  });

  it("wiele pozycji — licznik w nawiasie", () => {
    expect(myOrderPickupAckLabel(2)).toBe("Potwierdź odbiór (2)");
    expect(myOrderPickupAckLabel(3)).toBe("Potwierdź odbiór (3)");
  });

  it("informacja o dostępności", () => {
    expect(myOrderPickupAckLabel(5, "availability")).toBe("Potwierdź");
  });
});

describe("myOrderPickupAckTitle", () => {
  it("odbiór wielu pozycji", () => {
    expect(myOrderPickupAckTitle(3)).toContain("3 poz.");
  });
});
