import { describe, expect, it } from "vitest";
import { authTickLines, roundSvgCoord } from "@/components/auth/auth-background-geometry";

describe("auth background art", () => {
  it("rounds svg coords to fixed decimal strings", () => {
    expect(roundSvgCoord(237.24999999999997)).toBe("237.25");
    expect(roundSvgCoord(5.954827976430522)).toBe("5.95");
  });

  it("produces stable tick line attributes", () => {
    const ticks = authTickLines(280, 80, 95, 0.86);
    expect(ticks).toHaveLength(12);
    for (const tick of ticks) {
      expect(tick.x1).toMatch(/^-?\d+\.\d{2}$/);
      expect(tick.y1).toMatch(/^-?\d+\.\d{2}$/);
    }
  });
});
