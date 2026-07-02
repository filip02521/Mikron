import { describe, expect, it } from "vitest";
import {
  inferWiedentAlmamissShapeId,
  wiedentAlmamissMouldShapeGroups,
  WIEDENT_ALMAMISS_LOWER_ANTERIOR,
  WIEDENT_ALMAMISS_UPPER_ANTERIOR,
} from "./wiedent-almamiss-mould-shapes";

describe("wiedent-almamiss-mould-shapes", () => {
  it("przody — dolne i górne wg katalogu Almamiss", () => {
    const groups = wiedentAlmamissMouldShapeGroups("anterior");
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.shapeId)).toEqual(["lower", "upper"]);
    expect(groups[0]!.moulds).toEqual(WIEDENT_ALMAMISS_LOWER_ANTERIOR);
    expect(groups[1]!.moulds).toEqual(WIEDENT_ALMAMISS_UPPER_ANTERIOR);
    expect(groups[1]!.moulds).toContain("415");
  });

  it("boki — paleta 650–790", () => {
    const groups = wiedentAlmamissMouldShapeGroups("posterior");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.moulds).toEqual(["650", "700", "760", "780", "790"]);
  });

  it("inferWiedentAlmamissShapeId mapuje kody", () => {
    expect(inferWiedentAlmamissShapeId("104")).toBe("lower");
    expect(inferWiedentAlmamissShapeId("210")).toBe("upper");
    expect(inferWiedentAlmamissShapeId("650")).toBe("all");
  });
});
