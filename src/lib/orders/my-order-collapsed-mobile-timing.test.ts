import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { formatDateString } from "./dates";
import type { MyOrderRow } from "./my-order-presenter";
import {
  formatCollapsedDeliveryTimingLabel,
  myOrderCollapsedMobileTiming,
} from "./my-order-collapsed-mobile-timing";
import { todayInWarsaw } from "@/lib/time/warsaw";

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

describe("formatCollapsedDeliveryTimingLabel", () => {
  it("formatuje szacunek jako czytelną etykietę", () => {
    expect(formatCollapsedDeliveryTimingLabel(row())).toBe(
      "Brak informacji o planowanej dostawie"
    );
  });

  it("formatuje informację z e-maila", () => {
    expect(
      formatCollapsedDeliveryTimingLabel(
        row({
          kind: "informacja",
          requestKind: "informacja",
          timingLabel: "E-mail 18.06.2026",
        })
      )
    ).toBe("Dostępne od · 18.06.2026");
  });

  it("preferuje termin ZD nad szacunkiem", () => {
    const tomorrow = addDays(todayInWarsaw(), 1);
    const deadline = formatDateString(tomorrow);
    const shortDate = formatDateString(tomorrow, "dd.MM");

    expect(
      formatCollapsedDeliveryTimingLabel(
        row({
          timingLabel: "ok. 10.05.2026 (~5 dni rob.)",
          zdFulfillment: {
            deadline,
            dokNr: "ZD/1/2026",
            syncedAt: null,
            source: "zd",
          },
        })
      )
    ).toBe(`Jutro · ${shortDate}`);
  });
});

describe("myOrderCollapsedMobileTiming", () => {
  it("pokazuje sformatowany termin na mobile gdy istotny i brak subline", () => {
    expect(
      myOrderCollapsedMobileTiming(row(), {
        expanded: false,
        showProgress: true,
        collapsedSubline: null,
      })
    ).toBe("Brak informacji o planowanej dostawie");
  });

  it("nie duplikuje subline", () => {
    expect(
      myOrderCollapsedMobileTiming(row(), {
        expanded: false,
        showProgress: true,
        collapsedSubline: "Brak informacji o planowanej dostawie",
      })
    ).toBeNull();
  });

  it("ukrywa po rozwinięciu", () => {
    expect(
      myOrderCollapsedMobileTiming(row(), {
        expanded: true,
        showProgress: true,
        collapsedSubline: null,
      })
    ).toBeNull();
  });

  it("nie pokazuje terminu na mobile w sekcji potwierdzenia odbioru", () => {
    expect(
      myOrderCollapsedMobileTiming(
        row({
          acknowledgeMode: "pickup",
          pickupPendingCount: 1,
          timingLabel: "ok. 10.05.2026 (~5 dni rob.)",
        }),
        { expanded: false, showProgress: true, collapsedSubline: null }
      )
    ).toBeNull();
  });
});
