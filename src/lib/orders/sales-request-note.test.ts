import { describe, expect, it } from "vitest";
import {
  isRequestNotesAggregateSummary,
  linesHaveMixedRequestNotes,
  normalizeSalesRequestNote,
  requestNotesProcurementSublineSuffix,
  requestNotesSummary,
  sharedRequestNoteFromLines,
} from "@/lib/orders/sales-request-note";

describe("normalizeSalesRequestNote", () => {
  it("zwraca null dla pustej wartości", () => {
    expect(normalizeSalesRequestNote(null)).toBeNull();
    expect(normalizeSalesRequestNote("   ")).toBeNull();
  });

  it("obcina białe znaki i skraca do limitu", () => {
    expect(normalizeSalesRequestNote("  pilne  ")).toBe("pilne");
    expect(normalizeSalesRequestNote("a".repeat(600))?.length).toBe(500);
  });

  it("zachowuje podział wierszy w notatce", () => {
    expect(normalizeSalesRequestNote("  linia 1\nlinia 2  ")).toBe("linia 1\nlinia 2");
  });
});

describe("requestNotesSummary", () => {
  it("zwraca jedną wspólną notatkę", () => {
    expect(
      requestNotesSummary([
        { sales_request_note: "pilne" },
        { sales_request_note: "pilne" },
      ])
    ).toBe("pilne");
  });

  it("zwraca skrót przy różnych notatkach", () => {
    expect(
      requestNotesSummary([
        { sales_request_note: "a" },
        { sales_request_note: "b" },
      ])
    ).toBe("2 różnych notatek");
  });
});

describe("sharedRequestNoteFromLines", () => {
  it("zwraca notatkę tylko gdy wszystkie linie mają tę samą", () => {
    expect(
      sharedRequestNoteFromLines([
        { requestNote: "wspólna" },
        { requestNote: "wspólna" },
      ])
    ).toBe("wspólna");
    expect(
      sharedRequestNoteFromLines([
        { requestNote: "a" },
        { requestNote: "b" },
      ])
    ).toBeNull();
  });
});

describe("isRequestNotesAggregateSummary", () => {
  it("rozpoznaje skrót agregatu", () => {
    expect(isRequestNotesAggregateSummary("2 różnych notatek")).toBe(true);
    expect(isRequestNotesAggregateSummary("pilne")).toBe(false);
  });
});

describe("linesHaveMixedRequestNotes", () => {
  it("wykrywa różne uwagi na pozycjach", () => {
    expect(
      linesHaveMixedRequestNotes([
        { requestNote: "a" },
        { requestNote: "b" },
      ])
    ).toBe(true);
    expect(
      linesHaveMixedRequestNotes([
        { requestNote: "wspólna" },
        { requestNote: "wspólna" },
      ])
    ).toBe(false);
  });
});

describe("requestNotesProcurementSublineSuffix", () => {
  it("dodaje sufiks tylko przy różnych uwagach", () => {
    expect(
      requestNotesProcurementSublineSuffix([
        { requestNote: "a" },
        { requestNote: "b" },
      ])
    ).toBe(" · uwagi przy produktach");
    expect(
      requestNotesProcurementSublineSuffix([{ requestNote: "wspólna" }])
    ).toBe("");
  });
});
