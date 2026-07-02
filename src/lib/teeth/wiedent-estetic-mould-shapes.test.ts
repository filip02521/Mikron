import { describe, expect, it } from "vitest";
import {
  inferWiedentEsteticShapeId,
  wiedentEsteticMouldShapeGroups,
  WIEDENT_ESTETIC_UPPER_OVAL,
} from "./wiedent-estetic-mould-shapes";

describe("wiedent-estetic-mould-shapes", () => {
  it("grupuje przody wg katalogu PDF (owal / kwadrat / trójkąt / dolne)", () => {
    const groups = wiedentEsteticMouldShapeGroups("anterior");
    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "triangular", "square", "oval"]);
    expect(groups.find((g) => g.shapeId === "oval")?.moulds).toEqual(WIEDENT_ESTETIC_UPPER_OVAL);
    expect(groups.find((g) => g.shapeId === "square")?.moulds).toContain("46");
    expect(groups.find((g) => g.shapeId === "triangular")?.moulds).toContain("12");
    expect(groups.find((g) => g.shapeId === "lower")?.moulds).toContain("02");
  });

  it("inferWiedentEsteticShapeId mapuje kody", () => {
    expect(inferWiedentEsteticShapeId("32")).toBe("oval");
    expect(inferWiedentEsteticShapeId("27")).toBe("square");
    expect(inferWiedentEsteticShapeId("41")).toBe("triangular");
    expect(inferWiedentEsteticShapeId("011")).toBe("lower");
  });

  it("boki — jedna paleta", () => {
    const groups = wiedentEsteticMouldShapeGroups("posterior");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.moulds).toContain("72");
  });
});
