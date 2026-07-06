import { describe, expect, it } from "vitest";
import { salesDayStartNavCount } from "@/lib/sales/sales-day-start";
import type { MyOrdersInboxSummary } from "@/lib/orders/my-order-sales-ui";

describe("salesDayStartNavCount", () => {
  const inbox: MyOrdersInboxSummary = {
    pickupCount: 2,
    partialReadyCount: 0,
    cancelAckCount: 1,
    overdueCount: 0,
    verificationCount: 0,
    przedZamowieniemCount: 0,
    zamowioneCount: 0,
    availabilityPendingCount: 0,
    informacjaReadyCount: 1,
  };

  it("sumuje inbox, przypomnienia notatnika i tablicę dla badge Moje", () => {
    expect(salesDayStartNavCount(inbox, 3, 2)).toBe(9);
  });

  it("nie liczy osobnych badge ZK/Notatnik — tylko agregat Start dnia", () => {
    expect(salesDayStartNavCount(inbox, 0, 0)).toBe(4);
  });
});
