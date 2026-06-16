import { describe, expect, it } from "vitest";
import { noteStickyTiltDeg } from "@/components/notatnik/note-styles";

describe("noteStickyTiltDeg", () => {
  it("zwraca stabilny kąt dla tego samego id", () => {
    const a = noteStickyTiltDeg("note-abc");
    const b = noteStickyTiltDeg("note-abc");
    expect(a).toBe(b);
  });

  it("zwraca kąt w rozsądnym zakresie", () => {
    const tilt = noteStickyTiltDeg("note-xyz");
    expect(tilt).toBeGreaterThanOrEqual(-3);
    expect(tilt).toBeLessThanOrEqual(3);
  });
});
