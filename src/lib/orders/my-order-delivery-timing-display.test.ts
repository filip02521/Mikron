import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  buildMyOrderDeliveryTimingDisplay,
  parseMyOrderTimingLabel,
  shouldShowMyOrderExpandedDeliveryTiming,
} from "./my-order-delivery-timing-display";

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
    timingLabel: "ok. 10.05.2026 (~5 dni rob.)",
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
    headline: "Zamówione — czekamy na dostawę",
    headlineTone: "info",
    subline: null,
    ...extra,
  };
}

describe("my-order-delivery-timing-display", () => {
  it("parsuje timingLabel", () => {
    expect(parseMyOrderTimingLabel("ok. 10.05.2026 (~5 dni rob.) · mało historii · po terminie")).toEqual({
      estimate: "ok. 10.05.2026 (~5 dni rob.)",
      overdue: true,
      lowConfidence: true,
    });
  });

  it("buduje blok dla opóźnienia", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({ timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie" })
    );
    expect(display?.title).toBe("Termin u dostawcy minął");
    expect(display?.tone).toBe("overdue");
  });

  it("buduje blok gdy sync nie znalazł terminu ZD", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie",
        zdEtaNoMatch: true,
      })
    );
    expect(display?.title).toBe("Brak terminu w Subiekcie");
    expect(display?.detail).toContain("brak terminu");
  });

  it("buduje blok oczekiwania na sync ZD", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie",
        zdEtaPending: true,
      })
    );
    expect(display?.title).toBe("Sprawdzamy termin w ZD");
    expect(display?.detail).toContain("dokumentu ZD");
  });

  it("buduje blok dla terminu z ZD", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "do 03.07.2026 · ZD/81/2026",
        zdFulfillment: {
          deadline: "2026-07-03",
          dokNr: "ZD/81/2026",
          syncedAt: "2026-06-18T08:00:00Z",
          source: "zd",
        },
      })
    );
    expect(display?.title).toBe("Termin realizacji z ZD");
    expect(display?.tone).toBe("zd-sourced");
    expect(display?.detail).toContain("ZD/81/2026");
  });

  it("pokazuje blok w rozwinięciu dla zamówienia z ETA", () => {
    expect(shouldShowMyOrderExpandedDeliveryTiming(row(), true)).toBe(true);
    expect(shouldShowMyOrderExpandedDeliveryTiming(row(), false)).toBe(false);
    expect(shouldShowMyOrderExpandedDeliveryTiming(row({ kind: "informacja" }), true)).toBe(
      false
    );
    expect(
      shouldShowMyOrderExpandedDeliveryTiming(row({ acknowledgeMode: "pickup" }), true)
    ).toBe(false);
  });
});
