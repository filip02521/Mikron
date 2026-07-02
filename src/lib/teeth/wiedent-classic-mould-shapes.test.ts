import { describe, expect, it } from "vitest";
import {
  inferWiedentClassicShapeId,
  wiedentClassicMouldShapeGroups,
  WIEDENT_CLASSIC_LOWER_ANTERIOR,
  WIEDENT_CLASSIC_UPPER_ANTERIOR,
} from "./wiedent-classic-mould-shapes";

describe("wiedent-classic-mould-shapes", () => {
  it("przody — dolne i górne wg katalogu Classic", () => {
    const groups = wiedentClassicMouldShapeGroups("anterior");
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "upper"]);
    expect(groups[0]!.moulds).toEqual(WIEDENT_CLASSIC_LOWER_ANTERIOR);
    expect(groups[1]!.moulds).toContain("437");
    expect(groups[1]!.moulds).toEqual(WIEDENT_CLASSIC_UPPER_ANTERIOR);
  });

  it("boki — jedna paleta", () => {
    const groups = wiedentClassicMouldShapeGroups("posterior");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.moulds).toContain("14");
    expect(groups[0]!.moulds).toContain("57");
  });

  it("inferWiedentClassicShapeId mapuje kody", () => {
    expect(inferWiedentClassicShapeId("733")).toBe("lower");
    expect(inferWiedentClassicShapeId("402")).toBe("upper");
    expect(inferWiedentClassicShapeId("14")).toBe("all");
  });
});
