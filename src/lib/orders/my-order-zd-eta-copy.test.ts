import { describe, expect, it } from "vitest";
import { buildCollapsedZdPendingOnlyHint } from "./my-order-zd-eta-copy";

describe("my-order-zd-eta-copy", () => {
  it("odmienia liczbę pozycji czekających na sync ZD", () => {
    expect(buildCollapsedZdPendingOnlyHint(1)).toBe(
      "1 pozycja czeka na termin w ZD — rozwiń po szczegóły"
    );
    expect(buildCollapsedZdPendingOnlyHint(2)).toBe(
      "2 pozycje czekają na termin w ZD — rozwiń po szczegóły"
    );
    expect(buildCollapsedZdPendingOnlyHint(5)).toBe(
      "5 pozycji czeka na termin w ZD — rozwiń po szczegóły"
    );
  });
});
