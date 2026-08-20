import { describe, expect, it } from "vitest";
import {
  analyzeTeethMarkOrdered,
  orderHasTeethOrderFile,
  resolveTeethGroupOrderFile,
  TEETH_GROUP_ORDER_FILE_FALLBACK_NAME,
  teethOrderFileGroupKey,
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

describe("teethOrderFileGroupKey / resolveTeethGroupOrderFile", () => {
  it("grupuje po dostawcy, puste id jako jedna grupa", () => {
    expect(teethOrderFileGroupKey({ supplier_id: "ivoclar" })).toBe("ivoclar");
    expect(teethOrderFileGroupKey({ supplier_id: "  " })).toBe("__no_supplier");
    expect(teethOrderFileGroupKey({})).toBe("__no_supplier");
  });

  it("plik grupy = pierwszy kompletny path w zestawie", () => {
    expect(
      resolveTeethGroupOrderFile([
        { teeth_order_file_name: "x.xlsx" },
        { teeth_order_file_path: "teeth-orders/g/a.xlsx", teeth_order_file_name: "ivoclar.xlsx" },
      ])
    ).toEqual({ hasFile: true, fileName: "ivoclar.xlsx" });
    expect(resolveTeethGroupOrderFile([{ supplier_id: "x" }])).toEqual({
      hasFile: false,
      fileName: null,
    });
  });

  it("gdy jest path bez nazwy, pokazuje zastępczą etykietę a nie pusty upload", () => {
    expect(
      resolveTeethGroupOrderFile([{ teeth_order_file_path: "teeth-orders/g/a.xlsx" }])
    ).toEqual({ hasFile: true, fileName: TEETH_GROUP_ORDER_FILE_FALLBACK_NAME });
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

  it("jeden plik w grupie dostawcy pokrywa pozostałe prośby", () => {
    const map = new Map([
      [
        "a",
        {
          supplier_id: "ivoclar",
          teeth_details: [completeRow],
          teeth_order_file_path: "teeth-orders/a/a.xlsx",
          teeth_order_file_name: "ivoclar.xlsx",
        },
      ],
      [
        "b",
        {
          supplier_id: "ivoclar",
          teeth_details: [{ ...completeRow, id: "t2", order_id: "b" }],
        },
      ],
      [
        "c",
        {
          supplier_id: "ivoclar",
          teeth_details: [{ ...completeRow, id: "t3", order_id: "c" }],
        },
      ],
    ]);
    const analysis = analyzeTeethMarkOrdered(["b", "c"], map);
    expect(analysis.withSpecIds).toEqual(["b", "c"]);
    expect(analysis.withoutFileIds).toEqual([]);
    expect(analysis.hasMissingFile).toBe(false);
    expect(analysis.canMarkAny).toBe(true);
  });

  it("plik innej grupy dostawcy nie pokrywa zaznaczenia", () => {
    const map = new Map([
      [
        "a",
        {
          supplier_id: "ivoclar",
          teeth_details: [completeRow],
          teeth_order_file_path: "teeth-orders/a/a.xlsx",
        },
      ],
      [
        "b",
        {
          supplier_id: "vita",
          teeth_details: [{ ...completeRow, id: "t2", order_id: "b" }],
        },
      ],
    ]);
    const analysis = analyzeTeethMarkOrdered(["b"], map);
    expect(analysis.withSpecIds).toEqual([]);
    expect(analysis.withoutFileIds).toEqual(["b"]);
    expect(analysis.withoutFileGroupCount).toBe(1);
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
        withoutFileIds: [],
        withoutFileGroupCount: 0,
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
      withoutFileGroupCount: 0,
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
      withoutFileGroupCount: 1,
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
      withoutFileGroupCount: 1,
      hasMissingSpec: true,
      hasMissingFile: true,
      canMarkAny: false,
    });
    expect(msg).toContain(TEETH_MARK_ORDERED_BLOCKED_MESSAGE);
    expect(msg).toContain("pliku zamówienia");
  });

  it("informuje o pominięciu grupy bez pliku przy częściowym oznaczeniu", () => {
    const msg = teethMarkOrderedConfirmMessage({
      orderIds: ["a", "b"],
      withSpecIds: ["a"],
      withoutSpecIds: [],
      withoutFileIds: ["b"],
      withoutFileGroupCount: 1,
      hasMissingSpec: false,
      hasMissingFile: true,
      canMarkAny: true,
      selectedPositionCount: 2,
    });
    expect(msg).toMatch(/grupa dostawcy nie ma/);
  });

  it("nie mówi o 0 grupach, gdy brakuje pliku a licznik grup jest pusty", () => {
    const msg = teethMarkOrderedConfirmMessage({
      orderIds: ["a", "b"],
      withSpecIds: ["a"],
      withoutSpecIds: [],
      withoutFileIds: ["b"],
      withoutFileGroupCount: 0,
      hasMissingSpec: false,
      hasMissingFile: true,
      canMarkAny: true,
      selectedPositionCount: 2,
    });
    expect(msg).not.toMatch(/0 grup/);
    expect(msg).toMatch(/grupa dostawcy nie ma/);
  });
});
