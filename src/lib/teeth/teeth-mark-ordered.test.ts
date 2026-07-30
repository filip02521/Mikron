import { describe, expect, it } from "vitest";
import {
  analyzeTeethMarkOrdered,
  orderHasTeethOrderFile,
  teethMarkOrderedConfirmLabel,
  teethMarkOrderedConfirmMessage,
  TEETH_MARK_ORDERED_BLOCKED_MESSAGE,
  TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE,
} from "./teeth-mark-ordered";

const completeRow = {
  id: "t1",
  order_id: "a",
  position: 1,
  color: "A2",
  mould: "T1",
  size: null,
  jaw: "upper" as const,
  kind: "anterior" as const,
};

describe("orderHasTeethOrderFile", () => {
  it("wymaga ścieżki Storage (same name nie wystarczy)", () => {
    expect(orderHasTeethOrderFile({ teeth_order_file_name: "z.xlsx" })).toBe(false);
    expect(orderHasTeethOrderFile({ teeth_order_file_path: "teeth-orders/a/x.pdf" })).toBe(true);
    expect(
      orderHasTeethOrderFile({
        teeth_order_file_path: "teeth-orders/a/x.pdf",
        teeth_order_file_name: "x.pdf",
      })
    ).toBe(true);
    expect(orderHasTeethOrderFile({})).toBe(false);
  });
});

describe("analyzeTeethMarkOrdered", () => {
  it("separates orders with and without spec", () => {
    const map = new Map([
      [
        "a",
        {
          teeth_details: [completeRow],
          teeth_order_file_path: "teeth-orders/a/a.xlsx",
          teeth_order_file_name: "a.xlsx",
        },
      ],
      [
        "b",
        {
          teeth_details: [],
          teeth_order_file_path: "teeth-orders/b/b.xlsx",
          teeth_order_file_name: "b.xlsx",
        },
      ],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a", "b"], map);
    expect(analysis.withSpecIds).toEqual(["a"]);
    expect(analysis.withoutSpecIds).toEqual(["b"]);
    expect(analysis.withoutFileIds).toEqual([]);
    expect(analysis.hasMissingSpec).toBe(true);
    expect(analysis.hasMissingFile).toBe(false);
    expect(analysis.canMarkAny).toBe(true);
  });

  it("treats incomplete rows as missing spec", () => {
    const map = new Map([
      [
        "a",
        {
          teeth_details: [
            {
              id: "t2",
              order_id: "a",
              position: 1,
              color: "A2",
              mould: null,
              size: null,
              jaw: null,
              kind: null,
            },
          ],
          teeth_order_file_path: "teeth-orders/a/a.xlsx",
          teeth_order_file_name: "a.xlsx",
        },
      ],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a"], map);
    expect(analysis.withSpecIds).toEqual([]);
    expect(analysis.withoutSpecIds).toEqual(["a"]);
    expect(analysis.canMarkAny).toBe(false);
  });

  it("blokuje gotową specyfikację bez pliku zamówienia", () => {
    const map = new Map([
      ["a", { teeth_details: [completeRow] }],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a"], map);
    expect(analysis.withSpecIds).toEqual([]);
    expect(analysis.withoutFileIds).toEqual(["a"]);
    expect(analysis.hasMissingFile).toBe(true);
    expect(analysis.canMarkAny).toBe(false);
  });

  it("blokuje gdy jest tylko nazwa pliku bez path", () => {
    const map = new Map([
      ["a", { teeth_details: [completeRow], teeth_order_file_name: "a.xlsx" }],
    ]);
    const analysis = analyzeTeethMarkOrdered(["a"], map);
    expect(analysis.canMarkAny).toBe(false);
    expect(analysis.withoutFileIds).toEqual(["a"]);
  });
});

describe("teethMarkOrderedConfirmLabel", () => {
  it("blokuje gdy brak kompletnej listy", () => {
    expect(
      teethMarkOrderedConfirmLabel({
        orderIds: ["b"],
        withSpecIds: [],
        withoutSpecIds: ["b"],
        withoutFileIds: [],
        hasMissingSpec: true,
        hasMissingFile: false,
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
      withoutFileIds: [],
      hasMissingSpec: true,
      hasMissingFile: false,
      canMarkAny: false,
    });
    expect(msg).toContain(TEETH_MARK_ORDERED_BLOCKED_MESSAGE);
  });

  it("zwraca komunikat o braku pliku", () => {
    const msg = teethMarkOrderedConfirmMessage({
      orderIds: ["a"],
      withSpecIds: [],
      withoutSpecIds: [],
      withoutFileIds: ["a"],
      hasMissingSpec: false,
      hasMissingFile: true,
      canMarkAny: false,
    });
    expect(msg).toContain(TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE);
  });

  it("łączy brak listy i pliku gdy nic nie da się oznaczyć", () => {
    const msg = teethMarkOrderedConfirmMessage({
      orderIds: ["a", "b"],
      withSpecIds: [],
      withoutSpecIds: ["a"],
      withoutFileIds: ["b"],
      hasMissingSpec: true,
      hasMissingFile: true,
      canMarkAny: false,
    });
    expect(msg).toContain(TEETH_MARK_ORDERED_BLOCKED_MESSAGE);
    expect(msg).toContain("pliku zamówienia");
  });

  it("informuje o pominięciu próśb bez pliku przy częściowym oznaczeniu", () => {
    const msg = teethMarkOrderedConfirmMessage({
      orderIds: ["a", "b"],
      withSpecIds: ["a"],
      withoutSpecIds: [],
      withoutFileIds: ["b"],
      hasMissingSpec: false,
      hasMissingFile: true,
      canMarkAny: true,
      selectedPositionCount: 2,
    });
    expect(msg).toContain("bez pliku zamówienia");
  });
});
