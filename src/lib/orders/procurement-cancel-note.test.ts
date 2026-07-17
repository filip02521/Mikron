import { describe, expect, it } from "vitest";
import {
  buildProcurementCancelUpdate,
  canEditProcurementCancelNote,
  canOperationsCancelIndividualOrder,
  isProcurementCancelNotesAggregateSummary,
  isProcurementCancelNoteColumnMissing,
  isProcurementInitiatedCancel,
  linesHaveMixedProcurementCancelNotes,
  normalizeProcurementCancelNote,
  procurementCancelNotesMojeSublineSuffix,
  procurementCancelNotesSummary,
  sharedProcurementCancelNoteFromLines,
  throwIfProcurementCancelNoteColumnMissing,
} from "@/lib/orders/procurement-cancel-note";

describe("normalizeProcurementCancelNote", () => {
  it("zwraca null dla pustej wartości", () => {
    expect(normalizeProcurementCancelNote(null)).toBeNull();
    expect(normalizeProcurementCancelNote("   ")).toBeNull();
  });

  it("obcina białe znaki i skraca do limitu", () => {
    expect(normalizeProcurementCancelNote("  brak towaru  ")).toBe("brak towaru");
    expect(normalizeProcurementCancelNote("a".repeat(600))?.length).toBe(500);
  });
});

describe("isProcurementInitiatedCancel", () => {
  it("rozpoznaje anulowanie przez zakupy", () => {
    expect(
      isProcurementInitiatedCancel({
        status: "Anulowane",
        sales_cancelled_at: null,
      })
    ).toBe(true);
  });

  it("odrzuca rezygnację handlowca", () => {
    expect(
      isProcurementInitiatedCancel({
        status: "Anulowane",
        sales_cancelled_at: "2026-06-01T10:00:00Z",
      })
    ).toBe(false);
  });

  it("odrzuca inne statusy", () => {
    expect(
      isProcurementInitiatedCancel({
        status: "Nowe",
        sales_cancelled_at: null,
      })
    ).toBe(false);
  });
});

describe("procurementCancelNotesSummary", () => {
  it("zwraca jedną wspólną wiadomość", () => {
    expect(
      procurementCancelNotesSummary([
        { procurement_cancel_note: "brak na stanie" },
        { procurement_cancel_note: "brak na stanie" },
      ])
    ).toBe("brak na stanie");
  });

  it("zwraca skrót przy różnych wiadomościach", () => {
    expect(
      procurementCancelNotesSummary([
        { procurement_cancel_note: "a" },
        { procurement_cancel_note: "b" },
      ])
    ).toBe("2 różnych wiadomości");
  });
});

describe("sharedProcurementCancelNoteFromLines", () => {
  it("zwraca wiadomość tylko gdy wszystkie linie mają tę samą", () => {
    expect(
      sharedProcurementCancelNoteFromLines([
        { procurementCancelNote: "wspólna" },
        { procurementCancelNote: "wspólna" },
      ])
    ).toBe("wspólna");
    expect(
      sharedProcurementCancelNoteFromLines([
        { procurementCancelNote: "a" },
        { procurementCancelNote: "b" },
      ])
    ).toBeNull();
  });
});

describe("isProcurementCancelNotesAggregateSummary", () => {
  it("rozpoznaje skrót agregatu", () => {
    expect(isProcurementCancelNotesAggregateSummary("2 różnych wiadomości")).toBe(
      true
    );
    expect(isProcurementCancelNotesAggregateSummary("brak towaru")).toBe(false);
  });
});

describe("migration hint", () => {
  it("wykrywa brak kolumny procurement_cancel_note", () => {
    expect(
      isProcurementCancelNoteColumnMissing(
        'column individual_orders.procurement_cancel_note does not exist'
      )
    ).toBe(true);
    expect(() =>
      throwIfProcurementCancelNoteColumnMissing({
        message: "procurement_cancel_note missing",
      })
    ).toThrow(/063_procurement_cancel_note/);
  });
});

describe("buildProcurementCancelUpdate", () => {
  it("ustawia status i czyści flagi informacji", () => {
    expect(buildProcurementCancelUpdate(null)).toEqual({
      status: "Anulowane",
      informacja_queue_via_daily_panel: false,
      informacja_stock_out_reorder: false,
    });
  });

  it("dołącza znormalizowaną notatkę", () => {
    expect(buildProcurementCancelUpdate("  brak towaru  ")).toEqual({
      status: "Anulowane",
      informacja_queue_via_daily_panel: false,
      informacja_stock_out_reorder: false,
      procurement_cancel_note: "brak towaru",
      procurement_cancel_note_updated_at: expect.any(String),
    });
  });
});

describe("canEditProcurementCancelNote", () => {
  it("pozwala edytować przed potwierdzeniem handlowca", () => {
    expect(
      canEditProcurementCancelNote({
        status: "Anulowane",
        sales_cancelled_at: null,
        sales_acknowledged_at: null,
      })
    ).toBe(true);
  });

  it("blokuje po potwierdzeniu lub rezygnacji handlowca", () => {
    expect(
      canEditProcurementCancelNote({
        status: "Anulowane",
        sales_cancelled_at: "2026-06-01T10:00:00Z",
        sales_acknowledged_at: null,
      })
    ).toBe(false);
    expect(
      canEditProcurementCancelNote({
        status: "Anulowane",
        sales_cancelled_at: null,
        sales_acknowledged_at: "2026-06-02T10:00:00Z",
      })
    ).toBe(false);
  });
});

describe("canOperationsCancelIndividualOrder", () => {
  it("pozwala anulować Nowe i Weryfikacja bez rezygnacji handlowca", () => {
    expect(
      canOperationsCancelIndividualOrder({
        status: "Nowe",
        sales_cancelled_at: null,
      })
    ).toBe(true);
    expect(
      canOperationsCancelIndividualOrder({
        status: "Weryfikacja",
        sales_cancelled_at: null,
      })
    ).toBe(true);
  });

  it("blokuje po rezygnacji handlowca lub innym statusie", () => {
    expect(
      canOperationsCancelIndividualOrder({
        status: "Nowe",
        sales_cancelled_at: "2026-06-01T10:00:00Z",
      })
    ).toBe(false);
    expect(
      canOperationsCancelIndividualOrder({
        status: "Zamowione",
        sales_cancelled_at: null,
      })
    ).toBe(false);
  });
});

describe("linesHaveMixedProcurementCancelNotes", () => {
  it("wykrywa różne wiadomości na liniach", () => {
    expect(
      linesHaveMixedProcurementCancelNotes([
        { procurementCancelNote: "a" },
        { procurementCancelNote: "b" },
      ])
    ).toBe(true);
    expect(
      linesHaveMixedProcurementCancelNotes([
        { procurementCancelNote: "wspólna" },
        { procurementCancelNote: "wspólna" },
      ])
    ).toBe(false);
  });
});

describe("procurementCancelNotesMojeSublineSuffix", () => {
  it("dodaje sufiks przy mieszanych wiadomościach", () => {
    expect(
      procurementCancelNotesMojeSublineSuffix([
        { procurementCancelNote: "a" },
        { procurementCancelNote: "b" },
      ])
    ).toBe(" · wiadomości przy produktach");
    expect(
      procurementCancelNotesMojeSublineSuffix([{ procurementCancelNote: "wspólna" }])
    ).toBe("");
  });
});
