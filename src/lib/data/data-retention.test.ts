import { describe, expect, it } from "vitest";
import {
  DATA_RETENTION_MONTHS,
  dataRetentionCutoffDateOnly,
  dataRetentionCutoffIso,
} from "./data-retention";

describe("data-retention", () => {
  it("ustawia okres 3 miesięcy", () => {
    expect(DATA_RETENTION_MONTHS).toBe(3);
  });

  it("liczy cutoff kalendarzowo", () => {
    const ref = new Date("2026-05-15T12:00:00Z");
    expect(dataRetentionCutoffDateOnly(ref)).toBe("2026-02-15");
    expect(dataRetentionCutoffIso(ref).startsWith("2026-02-15")).toBe(true);
  });
});
