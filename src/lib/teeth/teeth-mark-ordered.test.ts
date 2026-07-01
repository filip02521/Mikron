import { describe, expect, it } from "vitest";
import {
  analyzeTeethMarkOrdered,
  teethMarkOrderedConfirmLabel,
  teethMarkOrderedConfirmMessage,
  TEETH_MARK_ORDERED_BLOCKED_MESSAGE,
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
    expect(analysis.canMarkAny).toBe(true);
  });

  it("treats incomplete rows as missing spec", () => {
    const map = new Map([
      ["a", { teeth_details: [{ position: 1, color: "A2" }] }],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a"], map);
    expect(analysis.withSpecIds).toEqual([]);
    expect(analysis.withoutSpecIds).toEqual(["a"]);
    expect(analysis.canMarkAny).toBe(false);
  });
});

describe("teethMarkOrderedConfirmLabel", () => {
  it("blokuje gdy brak kompletnej listy", () => {
    expect(
      teethMarkOrderedConfirmLabel({
        orderIds: ["b"],
        withSpecIds: [],
        withoutSpecIds: ["b"],
        hasMissingSpec: true,
        canMarkAny: false,
      })
    ).toBe("Zamknij");
  });
});

describe("teethMarkOrderedConfirmMessage", () => {
  it("zwraca komunikat blokady bez gotowych pozycji", () => {
    const msg = teethMarkOrderedConfirmMessage({
      orderIds: ["b"],
      withSpecIds: [],
      withoutSpecIds: ["b"],
      hasMissingSpec: true,
      canMarkAny: false,
    });
    expect(msg).toContain(TEETH_MARK_ORDERED_BLOCKED_MESSAGE);
  });
});
