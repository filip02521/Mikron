import { describe, expect, it } from "vitest";
import { salesDayStartNavCount } from "@/lib/sales/sales-day-start";
import type { MyOrdersInboxSummary } from "@/lib/orders/my-order-sales-ui";

describe("salesDayStartNavCount", () => {
  const inbox: MyOrdersInboxSummary = {
    pickupCount: 2,
    cancelAckCount: 1,
    informacjaReadyCount: 1,
    weekPlanCount: 0,
  };

  it("sumuje inbox, przypomnienia notatnika i tablicę dla badge Moje", () => {
    expect(salesDayStartNavCount(inbox, 3, 2)).toBe(9);
  });

  it("nie liczy osobnych badge ZK/Notatnik — tylko agregat Start dnia", () => {
    expect(salesDayStartNavCount(inbox, 0, 0)).toBe(4);
  });
});
