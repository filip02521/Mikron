import { describe, expect, it } from "vitest";
import { isStockExemptTwId, toStockExemptTwIdSet } from "./teeth-stock-exempt";

describe("teeth-stock-exempt", () => {
  it("rozpoznaje tw_Id z listy", () => {
    const set = toStockExemptTwIdSet([10, 20]);
    expect(isStockExemptTwId(10, set)).toBe(true);
    expect(isStockExemptTwId(99, set)).toBe(false);
  });

  it("ignoruje puste i nieprawidłowe identyfikatory", () => {
    const set = toStockExemptTwIdSet([10]);
    expect(isStockExemptTwId(null, set)).toBe(false);
    expect(isStockExemptTwId(0, set)).toBe(false);
    expect(isStockExemptTwId(undefined, set)).toBe(false);
  });
});
