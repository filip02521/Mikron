import { describe, expect, it } from "vitest";
import {
  formatProcurementGroupSubmittedLabel,
  formatProcurementSubmittedLabel,
} from "./procurement-request-timing";

describe("procurement-request-timing", () => {
  const now = new Date("2026-05-28T12:00:00+02:00");

  it("formatuje zgłoszenie z dzisiaj", () => {
    expect(
      formatProcurementSubmittedLabel("2026-05-28T08:30:00+02:00", now)
    ).toBe("dziś 08:30");
  });

  it("formatuje zgłoszenie z wczoraj", () => {
    expect(
      formatProcurementSubmittedLabel("2026-05-27T16:45:00+02:00", now)
    ).toBe("wczoraj 16:45");
  });

  it("formatuje starsze zgłoszenie z datą", () => {
    expect(
      formatProcurementSubmittedLabel("2026-05-20T09:15:00+02:00", now)
    ).toBe("20.05.2026 09:15");
  });

  it("formatuje samą datę bez fałszywej godziny", () => {
    expect(formatProcurementSubmittedLabel("2026-05-28", now)).toBe("dziś");
    expect(formatProcurementSubmittedLabel("2026-05-20", now)).toBe("20.05.2026");
  });

  it("formatuje zakres w tym samym dniu", () => {
    expect(
      formatProcurementGroupSubmittedLabel(
        "2026-05-28T08:00:00+02:00",
        "2026-05-28T10:30:00+02:00",
        now
      )
    ).toBe("dziś 08:00–10:30");
  });
});
