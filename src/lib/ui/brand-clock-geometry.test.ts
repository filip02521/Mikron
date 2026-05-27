import { describe, expect, it } from "vitest";
import {
  BRAND_CLOCK_INTRO_ANGLES,
  brandClockAnglesFromDate,
} from "@/lib/ui/brand-clock-geometry";

describe("brandClockAnglesFromDate", () => {
  it("maps 10:30:20 to expected SVG angles", () => {
    const angles = brandClockAnglesFromDate(new Date(2026, 4, 26, 10, 30, 20));

    expect(angles.hour).toBeCloseTo(315.17, 1);
    expect(angles.minute).toBeCloseTo(182, 4);
  });

  it("maps noon exactly to 12 o'clock", () => {
    const angles = brandClockAnglesFromDate(new Date(2026, 4, 26, 12, 0, 0));

    expect(angles.hour).toBeCloseTo(0, 4);
    expect(angles.minute).toBeCloseTo(0, 4);
  });
});

describe("BRAND_CLOCK_INTRO_ANGLES", () => {
  it("matches decorative 10:30 hand positions", () => {
    expect(BRAND_CLOCK_INTRO_ANGLES.hour).toBe(315);
    expect(BRAND_CLOCK_INTRO_ANGLES.minute).toBe(180);
  });
});
