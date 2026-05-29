import { describe, expect, it } from "vitest";
import {
  assertJournalDateReadable,
  parseJournalDateKey,
  shiftJournalDateKey,
} from "@/lib/warehouse/delivery-receipts";

describe("delivery journal dates", () => {
  it("parses YYYY-MM-DD", () => {
    expect(parseJournalDateKey("2026-05-28")).toBe("2026-05-28");
    expect(parseJournalDateKey("2026-13-01")).toBeNull();
    expect(parseJournalDateKey("bad")).toBeNull();
  });

  it("shifts calendar days", () => {
    expect(shiftJournalDateKey("2026-05-28", -1)).toBe("2026-05-27");
    expect(shiftJournalDateKey("2026-05-28", 1)).toBe("2026-05-29");
  });

  it("rejects future dates", () => {
    expect(() => assertJournalDateReadable("2099-01-01")).toThrow(/przyszł/);
  });
});
