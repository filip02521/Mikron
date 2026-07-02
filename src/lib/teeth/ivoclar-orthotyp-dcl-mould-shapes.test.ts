import { describe, expect, it } from "vitest";
import {
  inferIvoclarOrthotypDclShapeId,
  ivoclarOrthotypDclMouldShapeGroups,
  ORTHOTYP_DCL_POSTERIOR,
} from "./ivoclar-orthotyp-dcl-mould-shapes";

describe("ivoclar-orthotyp-dcl-mould-shapes", () => {
  it("grupuje boki na Orthotyp i Lingual", () => {
    const groups = ivoclarOrthotypDclMouldShapeGroups("posterior");
    expect(groups).toHaveLength(4);
    expect(groups[0]?.moulds).toContain("N3U");
    expect(groups[1]?.moulds).toContain("N6L");
    expect(groups[2]?.moulds).toContain("LU5");
    expect(groups[3]?.moulds).toContain("LL3");
  });

  it("inferIvoclarOrthotypDclShapeId mapuje N*U/L i LU/LL", () => {
    expect(inferIvoclarOrthotypDclShapeId("N4U")).toBe("upper");
    expect(inferIvoclarOrthotypDclShapeId("N5L")).toBe("lower");
    expect(inferIvoclarOrthotypDclShapeId("LU6")).toBe("upper");
    expect(inferIvoclarOrthotypDclShapeId("N3")).toBe("upper");
  });

  it("posterior palette obejmuje Orthotyp, Lingual i legacy N3–N6", () => {
    expect(ORTHOTYP_DCL_POSTERIOR).toContain("N3U");
    expect(ORTHOTYP_DCL_POSTERIOR).toContain("LL6");
    expect(ORTHOTYP_DCL_POSTERIOR).toContain("N4");
  });
});
