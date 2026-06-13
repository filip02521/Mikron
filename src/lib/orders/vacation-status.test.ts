import { describe, it, expect } from "vitest";
import {
  isVacationEffectivelyActive,
  isVacationHistorical,
  isVacationPastArchive,
  isVacationScheduledInactive,
} from "./vacation-status";

describe("vacation-status", () => {
  const today = "2025-09-01";

  it("classifies effectively active rows", () => {
    expect(isVacationEffectivelyActive({ active: true, end_date: "2025-09-10" }, today)).toBe(
      true
    );
    expect(isVacationEffectivelyActive({ active: true, end_date: "2025-08-20" }, today)).toBe(
      false
    );
  });

  it("classifies scheduled inactive future rows", () => {
    expect(
      isVacationScheduledInactive({ active: false, end_date: "2025-10-01" }, today)
    ).toBe(true);
    expect(
      isVacationScheduledInactive({ active: true, end_date: "2025-10-01" }, today)
    ).toBe(false);
  });

  it("classifies historical rows", () => {
    expect(isVacationHistorical({ end_date: "2025-08-01" }, today)).toBe(true);
    expect(isVacationPastArchive({ active: true, end_date: "2025-08-01" }, today)).toBe(true);
  });
});
