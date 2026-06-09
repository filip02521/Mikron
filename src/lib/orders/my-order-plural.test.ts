import { describe, expect, it } from "vitest";
import { formatPickupBarLabel, formatPickupLineCount, formatProsbaCount } from "./my-order-plural";

describe("formatProsbaCount", () => {
  it("odmienia poprawnie", () => {
    expect(formatProsbaCount(1)).toBe("1 prośba");
    expect(formatProsbaCount(2)).toBe("2 prośby");
    expect(formatProsbaCount(5)).toBe("5 prośb");
    expect(formatProsbaCount(22)).toBe("22 prośby");
  });
});

describe("formatPickupBarLabel", () => {
  it("używa poprawnej odmiany", () => {
    expect(formatPickupBarLabel(5)).toBe("5 prośb do odbioru");
  });
});

describe("formatPickupLineCount", () => {
  it("odmienia pozycje", () => {
    expect(formatPickupLineCount(1)).toBe("1 pozycja");
    expect(formatPickupLineCount(3)).toBe("3 pozycje");
    expect(formatPickupLineCount(5)).toBe("5 pozycji");
  });
});
