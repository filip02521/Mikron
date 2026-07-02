import { describe, expect, it } from "vitest";
import {
  teethBuilderSteps,
  teethDualSaveBlockReason,
  teethDualSaveReady,
} from "@/lib/teeth/teeth-builder-copy";

describe("teethBuilderSteps", () => {
  it("omits jaw step for anterior", () => {
    const steps = teethBuilderSteps({
      kind: "anterior",
      color: "A2",
      mould: "32",
    });
    expect(steps.map((s) => s.label)).toEqual(["Kolor", "Kształt · fason", "Ilość"]);
    expect(steps[0]?.done).toBe(true);
    expect(steps[1]?.done).toBe(true);
  });

  it("includes jaw step for posterior", () => {
    const steps = teethBuilderSteps({
      kind: "posterior",
      color: "A2",
      mould: "60",
      jawMode: "both",
    });
    expect(steps.map((s) => s.label)).toEqual([
      "Kolor",
      "Kształt · fason",
      "Szczęka",
      "Ilość",
    ]);
    expect(steps[2]?.done).toBe(true);
  });
});

describe("teethDualSaveReady", () => {
  const empty = { hasItems: false, complete: false };
  const complete = { hasItems: true, complete: true };
  const incomplete = { hasItems: true, complete: false };

  it("rejects when both sections empty", () => {
    expect(teethDualSaveReady(empty, empty)).toBe(false);
    expect(teethDualSaveBlockReason(empty, empty)).toMatch(/Dodaj co najmniej/);
  });

  it("accepts single complete section", () => {
    expect(teethDualSaveReady(complete, empty)).toBe(true);
    expect(teethDualSaveReady(empty, complete)).toBe(true);
  });

  it("rejects incomplete section with items", () => {
    expect(teethDualSaveReady(incomplete, empty)).toBe(false);
    expect(teethDualSaveBlockReason(incomplete, empty)).toMatch(/Przednie/);
    expect(teethDualSaveBlockReason(empty, incomplete)).toMatch(/Boczne/);
  });

  it("accepts both complete sections", () => {
    expect(teethDualSaveReady(complete, complete)).toBe(true);
    expect(teethDualSaveBlockReason(complete, complete)).toBeNull();
  });
});
