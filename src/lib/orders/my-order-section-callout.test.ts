import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  deriveMyOrderSectionCallouts,
  deriveMyOrderSectionDisplayState,
  filterSectionCalloutsForInboxFilter,
  myOrderRowSuppressesSharedHeadline,
  myOrderSectionSuppressedPatterns,
  polishPozycjaCount,
} from "./my-order-section-callout";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: "1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [],
    submittedLabel: "01.05",
    supplierName: "Dostawca",
    product: "P",
    symbol: null,
    quantityLabel: "2 szt.",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "info",
    rowColor: "#fff",
    orderIds: ["1"],
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: false,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: null,
    supplierId: "s",
    salesPersonId: "sp",
    requestKind: "zamowienie",
    canEditBySales: false,
    headline: "Zamówione u dostawcy",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("my-order-section-callout", () => {
  it("polishPozycjaCount — odmiana", () => {
    expect(polishPozycjaCount(1)).toBe("1 pozycja");
    expect(polishPozycjaCount(2)).toBe("2 pozycje");
    expect(polishPozycjaCount(5)).toBe("5 pozycji");
    expect(polishPozycjaCount(22)).toBe("22 pozycje");
  });

  it("nie pokazuje calloutu przy pojedynczym wierszu", () => {
    const rows = [
      row({
        timingLabel: "ok. 10.05 · po terminie",
        headline: "Po przewidywanym terminie",
        headlineTone: "warning",
      }),
    ];
    expect(deriveMyOrderSectionCallouts(rows)).toEqual([]);
  });

  it("callout po terminie przy ≥2 wierszach", () => {
    const overdue = row({
      id: "a",
      timingLabel: "ok. 10.05 · po terminie",
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
    });
    const rows = [overdue, { ...overdue, id: "b", supplierName: "Inny" }];
    const callouts = deriveMyOrderSectionCallouts(rows);
    expect(callouts).toHaveLength(1);
    expect(callouts[0]?.pattern).toBe("overdue");
    expect(callouts[0]?.title).toContain("2 pozycje");
  });

  it("ukrywa callout gdy aktywny filtr overdue", () => {
    const callouts = deriveMyOrderSectionCallouts([
      row({ timingLabel: "x · po terminie", headlineTone: "warning" }),
      row({ id: "2", timingLabel: "y · po terminie", headlineTone: "warning" }),
    ]);
    expect(filterSectionCalloutsForInboxFilter(callouts, "overdue")).toEqual([]);
    expect(filterSectionCalloutsForInboxFilter(callouts, null)).toHaveLength(1);
  });

  it("ukrywa nagłówek przy filtrze overdue bez widocznego calloutu (≥2 wiersze)", () => {
    const overdue = row({
      timingLabel: "ok. 10.05 · po terminie",
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
    });
    const rows = [overdue, { ...overdue, id: "2" }];
    const { callouts, suppressedPatterns } = deriveMyOrderSectionDisplayState(
      rows,
      "overdue"
    );
    expect(callouts).toEqual([]);
    expect(myOrderRowSuppressesSharedHeadline(overdue, suppressedPatterns)).toBe(true);
  });

  it("nie ukrywa nagłówka przy filtrze overdue z jednym wierszem", () => {
    const overdue = row({
      timingLabel: "ok. 10.05 · po terminie",
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
    });
    const { suppressedPatterns } = deriveMyOrderSectionDisplayState([overdue], "overdue");
    expect(myOrderRowSuppressesSharedHeadline(overdue, suppressedPatterns)).toBe(false);
  });

  it("ukrywa powtarzający się nagłówek wiersza przy calloucie sekcji", () => {
    const overdue = row({
      timingLabel: "ok. 10.05 · po terminie",
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
    });
    const callouts = deriveMyOrderSectionCallouts([overdue, { ...overdue, id: "2" }]);
    const suppressed = myOrderSectionSuppressedPatterns(callouts);
    expect(myOrderRowSuppressesSharedHeadline(overdue, suppressed)).toBe(true);
    expect(myOrderRowSuppressesSharedHeadline(row(), suppressed)).toBe(false);
  });
});
