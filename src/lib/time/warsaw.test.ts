import { describe, expect, it } from "vitest";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw, warsawMidnightIso, warsawNowParts } from "./warsaw";

describe("todayInWarsaw", () => {
  it("zwraca datę zgodną z dateKey warszawskim", () => {
    const ref = new Date("2026-05-15T10:00:00Z");
    const { dateKey } = warsawNowParts(ref);
    expect(formatDateString(todayInWarsaw(ref))).toBe(dateKey);
  });
});

describe("warsawMidnightIso", () => {
  it("zimą +01:00, latem +02:00, także w dni zmiany czasu", () => {
    expect(warsawMidnightIso("2026-01-15")).toBe("2026-01-15T00:00:00+01:00");
    expect(warsawMidnightIso("2026-07-15")).toBe("2026-07-15T00:00:00+02:00");
    expect(warsawMidnightIso("2026-03-29")).toBe("2026-03-29T00:00:00+01:00");
    expect(warsawMidnightIso("2026-10-25")).toBe("2026-10-25T00:00:00+02:00");
  });
});
