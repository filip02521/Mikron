import { describe, expect, it } from "vitest";
import { isSupplierActive } from "./active";

describe("isSupplierActive", () => {
  it("traktuje brak pola jak aktywny", () => {
    expect(isSupplierActive({})).toBe(true);
  });

  it("false tylko gdy is_active === false", () => {
    expect(isSupplierActive({ is_active: false })).toBe(false);
    expect(isSupplierActive({ is_active: true })).toBe(true);
  });
});
