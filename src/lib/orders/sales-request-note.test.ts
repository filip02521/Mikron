import { describe, expect, it } from "vitest";
import {
  isRequestNotesAggregateSummary,
  isSalesRequestNoteUnread,
  linesHaveMixedRequestNotes,
  normalizeSalesRequestNote,
  requestNotesProcurementSublineSuffix,
  requestNotesSummary,
  sharedRequestNoteFromLines,
  unreadSalesRequestNoteOrderIds,
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

describe("isSalesRequestNoteUnread", () => {
  it("wymaga treści i updatedAt", () => {
    expect(
      isSalesRequestNoteUnread({
        note: "pilne",
        updatedAt: null,
        seenAt: null,
      })
    ).toBe(false);
    expect(
      isSalesRequestNoteUnread({
        note: "",
        updatedAt: "2025-01-01T00:00:00Z",
        seenAt: null,
      })
    ).toBe(false);
  });

  it("jest nieprzeczytane gdy brak seenAt lub seenAt starsze", () => {
    expect(
      isSalesRequestNoteUnread({
        note: "pilne",
        updatedAt: "2025-01-02T00:00:00Z",
        seenAt: null,
      })
    ).toBe(true);
    expect(
      isSalesRequestNoteUnread({
        note: "pilne",
        updatedAt: "2025-01-02T00:00:00Z",
        seenAt: "2025-01-01T00:00:00Z",
      })
    ).toBe(true);
    expect(
      isSalesRequestNoteUnread({
        note: "pilne",
        updatedAt: "2025-01-02T00:00:00Z",
        seenAt: "2025-01-02T00:00:00Z",
      })
    ).toBe(false);
  });

  it("zbiera ID nieprzeczytanych pozycji", () => {
    expect(
      unreadSalesRequestNoteOrderIds([
        {
          id: "a",
          sales_request_note: "x",
          sales_request_note_updated_at: "2025-01-02T00:00:00Z",
          sales_request_note_seen_at: null,
        },
        {
          id: "b",
          sales_request_note: "y",
          sales_request_note_updated_at: "2025-01-02T00:00:00Z",
          sales_request_note_seen_at: "2025-01-03T00:00:00Z",
        },
      ])
    ).toEqual(["a"]);
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
