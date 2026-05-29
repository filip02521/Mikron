import { describe, expect, it } from "vitest";
import { computeAnchoredDropdownPosition } from "./dropdown-anchor";

const VIEWPORT_H = 800;

function rect(bottom: number, height = 36): DOMRect {
  const top = bottom - height;
  return {
    top,
    bottom,
    left: 400,
    right: 500,
    width: 100,
    height,
    x: 400,
    y: top,
    toJSON() {
      return {};
    },
  };
}

describe("computeAnchoredDropdownPosition", () => {
  it("otwiera w dół gdy jest miejsce", () => {
    const pos = computeAnchoredDropdownPosition(rect(400), 280, {
      viewportHeight: VIEWPORT_H,
    });
    expect(pos.top).toBe(404);
    expect(pos.maxHeight).toBeGreaterThan(200);
  });

  it("otwiera w górę przy dolnej krawędzi viewportu", () => {
    const anchor = rect(VIEWPORT_H - 20);
    const pos = computeAnchoredDropdownPosition(anchor, 280, {
      viewportHeight: VIEWPORT_H,
    });
    expect(pos.top).toBeLessThan(anchor.top);
    expect(pos.top + 280).toBeLessThanOrEqual(anchor.top);
  });
});
