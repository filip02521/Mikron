import { describe, expect, it } from "vitest";
import {
  inferMajorSuperLuxShapeId,
  majorSuperLuxMouldShapeGroups,
  MAJOR_SUPER_LUX_LOWER_ANTERIOR,
  MAJOR_SUPER_LUX_POSTERIOR,
  MAJOR_SUPER_LUX_UPPER_OVAL,
  MAJOR_SUPER_LUX_UPPER_SQUARE,
  MAJOR_SUPER_LUX_UPPER_TRIANGULAR,
} from "./major-super-lux-mould-shapes";

describe("major-super-lux-mould-shapes", () => {
  it("przody — dolne, trójkątne, owalne, kwadratowe", () => {
    const groups = majorSuperLuxMouldShapeGroups("anterior");
    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "triangular", "oval", "square"]);
    expect(groups[0]!.moulds).toEqual(MAJOR_SUPER_LUX_LOWER_ANTERIOR);
    expect(groups[1]!.moulds).toEqual(MAJOR_SUPER_LUX_UPPER_TRIANGULAR);
    expect(groups[2]!.moulds).toEqual(MAJOR_SUPER_LUX_UPPER_OVAL);
    expect(groups[3]!.moulds).toEqual(MAJOR_SUPER_LUX_UPPER_SQUARE);
  });

  it("boki — L-cusp wg kształtu + N-cusp", () => {
    const groups = majorSuperLuxMouldShapeGroups("posterior");
    expect(groups.map((g) => g.shapeId)).toEqual(["triangular", "oval", "square", "all"]);
    expect(groups[0]!.moulds).toEqual(["1/60"]);
    expect(groups[3]!.moulds).toEqual(["70N", "76N", "77N", "79N"]);
    expect(MAJOR_SUPER_LUX_POSTERIOR).toHaveLength(8);
  });

  it("inferMajorSuperLuxShapeId mapuje prefiks 0/", () => {
    expect(inferMajorSuperLuxShapeId("0/5")).toBe("lower");
    expect(inferMajorSuperLuxShapeId("50")).toBe("triangular");
    expect(inferMajorSuperLuxShapeId("56")).toBe("oval");
    expect(inferMajorSuperLuxShapeId("1/27")).toBe("square");
    expect(inferMajorSuperLuxShapeId("1/74")).toBe("oval");
    expect(inferMajorSuperLuxShapeId("70N")).toBe("all");
  });
});
