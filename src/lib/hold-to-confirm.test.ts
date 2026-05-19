import { describe, expect, it } from "vitest";

function holdProgress(elapsedMs: number, holdMs: number): number {
  return Math.min(1, elapsedMs / holdMs);
}

describe("holdProgress", () => {
  it("osiąga 1 po pełnym czasie przytrzymania", () => {
    expect(holdProgress(650, 650)).toBe(1);
    expect(holdProgress(800, 650)).toBe(1);
  });

  it("jest proporcjonalny w trakcie", () => {
    expect(holdProgress(325, 650)).toBeCloseTo(0.5);
  });
});
