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
  resolveMyOrderRowPatternHint,
} from "./my-order-section-callout";
import { createTestMyOrderRow } from "./test-fixtures";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return createTestMyOrderRow(extra);
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

  it("nie pokazuje calloutu po terminie ani częściowej dostawy", () => {
    const overdue = row({
      id: "a",
      timingLabel: "ok. 10.05 · po terminie",
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
    });
    const rows = [overdue, { ...overdue, id: "b", supplierName: "Inny" }];
    expect(deriveMyOrderSectionCallouts(rows)).toEqual([]);

    const partial = presentMyOrders([partialOrder], []).zamowienia[0]!;
    expect(deriveMyOrderSectionCallouts([partial, { ...partial, id: "p2" }])).toEqual([]);
  });

  it("callout weryfikacji przy ≥2 wierszach", () => {
    const verification = row({
      statusTitle: "W dziale dostaw",
      headline: "Prośba jest weryfikowana",
      headlineTone: "info",
    });
    const rows = [verification, { ...verification, id: "b", supplierName: "Inny" }];
    const callouts = deriveMyOrderSectionCallouts(rows);
    expect(callouts).toHaveLength(1);
    expect(callouts[0]?.pattern).toBe("verification");
    expect(callouts[0]?.title).toContain("2 pozycje");
  });

  it("nie pokazuje hintu przy pojedynczej częściowej dostawie", () => {
    const partial = presentMyOrders([partialOrder], []).zamowienia[0]!;
    const { callouts, singleHints, suppressedPatterns } = deriveMyOrderSectionDisplayState(
      [partial]
    );
    expect(callouts).toEqual([]);
    expect(singleHints).toEqual([]);
    expect(myOrderRowSuppressesSharedHeadline(partial, suppressedPatterns)).toBe(false);
  });

  it("ukrywa powtarzający się nagłówek wiersza przy calloucie weryfikacji", () => {
    const verification = row({
      statusTitle: "W dziale dostaw",
      headline: "Prośba jest weryfikowana",
      headlineTone: "info",
    });
    const callouts = deriveMyOrderSectionCallouts([
      verification,
      { ...verification, id: "2" },
    ]);
    const suppressed = myOrderSectionSuppressedPatterns(callouts);
    expect(myOrderRowSuppressesSharedHeadline(verification, suppressed)).toBe(true);
    expect(myOrderRowSuppressesSharedHeadline(row(), suppressed)).toBe(false);
  });

  it("resolveMyOrderRowPatternHint — tylko weryfikacja", () => {
    const overdue = row({
      timingLabel: "ok. 10.05 · po terminie",
      headline: "Po przewidywanym terminie",
      headlineTone: "warning",
    });
    expect(resolveMyOrderRowPatternHint(overdue)).toBeNull();

    const partial = presentMyOrders([partialOrder], []).zamowienia[0]!;
    expect(resolveMyOrderRowPatternHint(partial)).toBeNull();

    const verification = row({
      statusTitle: "W dziale dostaw",
      headline: "Prośba jest weryfikowana",
      headlineTone: "info",
    });
    expect(resolveMyOrderRowPatternHint(verification)?.pattern).toBe("verification");
    expect(
      resolveMyOrderRowPatternHint(verification, new Set(["verification"]))
    ).toBeNull();
  });
});
