import { describe, expect, it } from "vitest";
import {
  inferIvoclarVivodentDclShapeId,
  ivoclarVivodentDclMouldShapeGroups,
  VIVODENT_DCL_ANTERIOR,
  VIVODENT_DCL_LOWER_ANTERIOR,
} from "./ivoclar-vivodent-dcl-mould-shapes";

describe("ivoclar-vivodent-dcl-mould-shapes", () => {
  it("grupuje przody na trójkątne / kwadratowe / owalne / dolne", () => {
    const groups = ivoclarVivodentDclMouldShapeGroups("anterior");
    expect(groups).toHaveLength(4);
    expect(groups.map((g) => g.label)).toEqual([
      "Trójkątne",
      "Kwadratowe",
      "Owalne",
      "Dolne",
    ]);
    expect(groups[0]?.moulds).toContain("A11");
    expect(groups[1]?.moulds).toContain("A54");
    expect(groups[2]?.moulds).toContain("A25");
    expect(groups[3]?.moulds).toEqual(VIVODENT_DCL_LOWER_ANTERIOR);
  });

  it("inferIvoclarVivodentDclShapeId mapuje serie A*", () => {
    expect(inferIvoclarVivodentDclShapeId("A14")).toBe("triangular");
    expect(inferIvoclarVivodentDclShapeId("A27")).toBe("oval");
    expect(inferIvoclarVivodentDclShapeId("A66")).toBe("square");
    expect(inferIvoclarVivodentDclShapeId("A7")).toBe("lower");
  });

  it("anterior palette ma 29 fasonów z PDF", () => {
    expect(VIVODENT_DCL_ANTERIOR).toHaveLength(29);
    expect(VIVODENT_DCL_ANTERIOR).toContain("A24B");
  });
});
