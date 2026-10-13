import { describe, expect, it } from "vitest";
import { isTimingOverdue, stripTimingOverdue, timingOverdueSuffix } from "./timing-overdue";

describe("timing-overdue", () => {
  it("zapis i odczyt są spójne", () => {
    const label = `ok. 12.10.2026 (~5 dni rob.)${timingOverdueSuffix(true)}`;
    expect(isTimingOverdue(label)).toBe(true);
    expect(stripTimingOverdue(label)).toBe("ok. 12.10.2026 (~5 dni rob.)");
    expect(isTimingOverdue(`ok. 12.10.2026${timingOverdueSuffix(false)}`)).toBe(false);
    expect(isTimingOverdue(null)).toBe(false);
  });
});
