import { describe, expect, it } from "vitest";
import {
  analyzeTeethMarkOrdered,
  teethMarkOrderedConfirmLabel,
} from "./teeth-mark-ordered";

describe("analyzeTeethMarkOrdered", () => {
  it("separates orders with and without spec", () => {
    const completeRow = {
      position: 1,
      color: "A2",
      mould: "T1",
      jaw: "upper" as const,
      kind: "anterior" as const,
    };
    const map = new Map([
      ["a", { teeth_details: [completeRow] }],
      ["b", { teeth_details: [] }],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a", "b"], map);
    expect(analysis.withSpecIds).toEqual(["a"]);
    expect(analysis.withoutSpecIds).toEqual(["b"]);
    expect(analysis.hasMissingSpec).toBe(true);
  });

  it("treats incomplete rows as missing spec", () => {
    const map = new Map([
      ["a", { teeth_details: [{ position: 1, color: "A2" }] }],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a"], map);
    expect(analysis.withSpecIds).toEqual([]);
    expect(analysis.withoutSpecIds).toEqual(["a"]);
  });
});

describe("teethMarkOrderedConfirmLabel", () => {
  it("uses danger label when missing spec", () => {
    expect(
      teethMarkOrderedConfirmLabel({
        orderIds: ["b"],
        withSpecIds: [],
        withoutSpecIds: ["b"],
        hasMissingSpec: true,
      })
    ).toBe("Zamów mimo braków");
  });
});
