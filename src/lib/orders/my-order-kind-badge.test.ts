import { describe, expect, it } from "vitest";
import {
  MY_ORDER_INFORMACJA_KIND_BADGE,
  shouldShowMyOrderKindBadge,
} from "./my-order-kind-badge";

describe("my-order-kind-badge", () => {
  it("pokazuje badge tylko dla prośby informacyjnej", () => {
    expect(shouldShowMyOrderKindBadge({ kind: "informacja" })).toBe(true);
    expect(shouldShowMyOrderKindBadge({ kind: "zamowienie" })).toBe(false);
  });

  it("ma czytelną etykietę bez skrótu", () => {
    expect(MY_ORDER_INFORMACJA_KIND_BADGE).toBe("Informacyjna");
    expect(MY_ORDER_INFORMACJA_KIND_BADGE).not.toMatch(/\./);
  });
});
