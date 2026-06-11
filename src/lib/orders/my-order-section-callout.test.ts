import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import { presentMyOrders } from "./my-order-presenter";
import type { IndividualOrder } from "@/types/database";
import {
  deriveMyOrderSectionCallouts,
  deriveMyOrderSectionDisplayState,
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

const partialOrder: IndividualOrder = {
  id: "p1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "3",
  delivered_quantity: "2",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Czesciowo_zrealizowane",
  action_at: "2026-04-28",
  ordered_at: "2026-05-01",
  delivery_at: null,
  supplier: {
    id: "sup1",
    name: "Dostawca X",
    location: "POLSKA",
    pickup_mikran: false,
    pickup_pallet: false,
    notes: "",
    mails: "",
    extra_info: "",
    interval_raw: null,
    interval_weeks: null,
    stock_raw: null,
    stock: null,
    stats_mode: "LACZNIE",
    order_on_demand: false,
    is_active: true,
  },
};

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

  it("callout częściowej dostawy — ton sky, bez obietnicy odbioru teraz", () => {
    const partial = presentMyOrders([partialOrder], []).zamowienia[0]!;
    const rows = [partial, { ...partial, id: "p2", supplierName: "Inny" }];
    const callouts = deriveMyOrderSectionCallouts(rows);
    expect(callouts).toHaveLength(1);
    expect(callouts[0]?.tone).toBe("sky");
    expect(callouts[0]?.title).toContain("Częściowa dostawa");
    expect(callouts[0]?.detail).toContain("Część towaru jest na magazynie");
    expect(callouts[0]?.detail).toContain("reszta w drodze");
  });

  it("pokazuje hint przy pojedynczej częściowej dostawie", () => {
    const partial = presentMyOrders([partialOrder], []).zamowienia[0]!;
    const { callouts, singleHints, suppressedPatterns } = deriveMyOrderSectionDisplayState(
      [partial]
    );
    expect(callouts).toEqual([]);
    expect(singleHints).toHaveLength(1);
    expect(singleHints[0]?.pattern).toBe("partial_ready");
    expect(singleHints[0]?.message).toContain("Część towaru jest na magazynie");
    expect(myOrderRowSuppressesSharedHeadline(partial, suppressedPatterns)).toBe(true);
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
