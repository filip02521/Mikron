import { describe, expect, it } from "vitest";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw, warsawNowParts } from "./warsaw";

describe("todayInWarsaw", () => {
  it("zwraca datę zgodną z dateKey warszawskim", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const { dateKey } = warsawNowParts(ref);
    expect(formatDateString(todayInWarsaw(ref))).toBe(dateKey);
  });
});
