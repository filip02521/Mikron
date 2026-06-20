import { describe, expect, it } from "vitest";
import { maxIsoTimestamp } from "./sales-person-activity";

describe("maxIsoTimestamp", () => {
  it("zwraca najpóźniejszy timestamp", () => {
    expect(
      maxIsoTimestamp("2026-06-15T08:00:00.000Z", "2026-06-18T10:00:00.000Z", null)
    ).toBe("2026-06-18T10:00:00.000Z");
  });

  it("zwraca null gdy brak wartości", () => {
    expect(maxIsoTimestamp(null, undefined)).toBeNull();
  });
});
