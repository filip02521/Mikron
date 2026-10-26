import { describe, expect, it } from "vitest";
import { isZdAutoProposalDue } from "./zd-auto-proposals";

describe("isZdAutoProposalDue", () => {
  it("pierwsza propozycja od razu, potem co cykl dni", () => {
    expect(isZdAutoProposalDue({ cycleDays: 3, lastCreatedDateKey: null, todayKey: "2026-10-21" })).toBe(true);
    expect(isZdAutoProposalDue({ cycleDays: 3, lastCreatedDateKey: "2026-10-19", todayKey: "2026-10-21" })).toBe(false);
    expect(isZdAutoProposalDue({ cycleDays: 3, lastCreatedDateKey: "2026-10-18", todayKey: "2026-10-21" })).toBe(true);
  });
  it("bez cyklu nigdy", () => {
    expect(isZdAutoProposalDue({ cycleDays: null, lastCreatedDateKey: null, todayKey: "2026-10-21" })).toBe(false);
  });
});
