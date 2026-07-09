import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL, MY_ORDER_HISTORY_ESTIMATE_TITLE, MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL } from "@/lib/orders/my-order-history-estimate-copy";
import {
  ZD_ETA_TIMING_SYNC_IN_PROGRESS,
  ZD_ETA_TIMING_TITLE_NO_MATCH,
  ZD_ETA_TIMING_TITLE_PENDING,
} from "@/lib/orders/my-order-zd-eta-copy";
import {
  buildMyOrderDeliveryTimingDisplay,
  parseMyOrderTimingLabel,
  shouldShowMyOrderCollapsedDeliveryTiming,
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
    pickupTeethPendingIds: [],
    pickupShelfPendingIds: [],
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
    requestNote: null,
    procurementCancelNote: null,
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
    expect(display?.title).toBe(MY_ORDER_HISTORY_ESTIMATE_TITLE);
    expect(display?.estimate).toBe("Brak informacji o planowanej dostawie");
    expect(display?.tone).toBe("overdue");
    expect(display?.urgencyLabel).toBeNull();
  });

  it("buduje blok gdy sync nie znalazł terminu ZD", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie",
        zdEtaNoMatch: true,
      })
    );
    expect(display?.title).toBe(ZD_ETA_TIMING_TITLE_NO_MATCH);
    expect(display?.estimate).toBe("Brak informacji o planowanej dostawie");
    expect(display?.urgency).toBe("overdue");
    expect(display?.urgencyLabel).toBeNull();
  });

  it("buduje blok oczekiwania na sync ZD", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "ok. 22.08.2026 (~5 dni rob.)",
        zdEtaPending: true,
      })
    );
    expect(display?.title).toBe(ZD_ETA_TIMING_TITLE_PENDING);
    expect(display?.detail).toContain(MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL.slice(0, 20));
  });

  it("pending z przeterminowanym szacunkiem — brak informacji o dostawie", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie",
        zdEtaPending: true,
      })
    );
    expect(display?.estimate).toBe("Brak informacji o planowanej dostawie");
    expect(display?.detail).toContain("Termin z historii minął");
  });

  it("pokazuje pending bez statystycznego ETA", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: null,
        zdEtaPending: true,
      })
    );
    expect(display?.title).toBe(ZD_ETA_TIMING_TITLE_PENDING);
    expect(display?.estimate).toContain(ZD_ETA_TIMING_SYNC_IN_PROGRESS.slice(0, 12));
    expect(shouldShowMyOrderExpandedDeliveryTiming(row({ timingLabel: null, zdEtaPending: true }), true)).toBe(
      true
    );
  });

  it("nie pokazuje badge pilności dla jutra — tylko neutralne meta ZD", () => {
    const tomorrowKey = formatDateString(addDays(todayInWarsaw(), 1));
    const tomorrowPl = formatDateString(addDays(todayInWarsaw(), 1), "dd.MM.yyyy");
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: `${tomorrowPl} · ZD/1`,
        zdFulfillment: {
          deadline: tomorrowKey,
          dokNr: "ZD/1",
          syncedAt: null,
          source: "zd",
        },
      })
    );
    expect(display?.urgencyLabel).toBeNull();
    expect(display?.tone).toBe("zd-sourced");
    expect(display?.estimate).toContain("ZD/1");
    expect(display?.detail ?? "").not.toContain("ZD/1");
  });

  it("buduje blok dla terminu z ZD", () => {
    const futureKey = formatDateString(addDays(todayInWarsaw(), 14));
    const futurePl = formatDateString(addDays(todayInWarsaw(), 14), "dd.MM.yyyy");
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: `${futurePl} · ZD/81/2026`,
        zdFulfillment: {
          deadline: futureKey,
          dokNr: "ZD/81/2026",
          syncedAt: "2026-06-18T08:00:00Z",
          source: "zd",
        },
      })
    );
    expect(display?.title).toBe("Planowana dostawa:");
    expect(display?.tone).toBe("zd-sourced");
    expect(display?.estimate).toContain("ZD/81/2026");
    expect(display?.detail ?? "").not.toContain("zaktualizowano");
  });

  it("dokNr w estimate — bez powtórzenia w detail", () => {
    const deadlineKey = formatDateString(addDays(todayInWarsaw(), 5));
    const deadlinePl = formatDateString(addDays(todayInWarsaw(), 5), "dd.MM.yyyy");
    const syncedKey = formatDateString(addDays(todayInWarsaw(), -1));
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: `${deadlinePl} · ZD 173/M/06/2026`,
        zdFulfillment: {
          deadline: deadlineKey,
          dokNr: "ZD 173/M/06/2026",
          syncedAt: `${syncedKey}T08:00:00Z`,
          source: "zd",
        },
        zdEtaNoMatch: true,
      })
    );
    expect(display?.estimate).toContain("ZD 173/M/06/2026");
    expect(display?.detail ?? "").not.toContain("ZD 173/M/06/2026 ·");
    expect(display?.detail ?? "").not.toContain("zaktualizowano");
  });

  it("grupa mieszana — callout ZD z podpowiedzią o szacunku przy produktach", () => {
    const deadlineKey = formatDateString(addDays(todayInWarsaw(), 5));
    const deadlinePl = formatDateString(addDays(todayInWarsaw(), 5), "dd.MM.yyyy");
    const syncedKey = formatDateString(addDays(todayInWarsaw(), -2));
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: `${deadlinePl} · ZD 173/M/06/2026`,
        zdFulfillment: {
          deadline: deadlineKey,
          dokNr: "ZD 173/M/06/2026",
          syncedAt: `${syncedKey}T08:00:00Z`,
          source: "zd",
        },
        zdEtaNoMatch: true,
      })
    );
    expect(display?.title).toBe("Planowana dostawa:");
    expect(display?.estimate).toContain(deadlinePl);
    expect(display?.detail).toContain(MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL);
  });

  it("w rozwinięciu wymienia wszystkie terminy ZD", () => {
    const display = buildMyOrderDeliveryTimingDisplay(
      row({
        timingLabel: "15.07.2026 · ZD/1",
        zdFulfillment: {
          deadline: "2026-07-15",
          dokNr: "ZD/1",
          syncedAt: "2026-06-18T08:00:00Z",
          source: "zd",
          slots: [
            { deadline: "2026-07-15", dokNr: "ZD/1", count: 1 },
            { deadline: "2026-07-22", dokNr: "ZD/2", count: 1 },
          ],
        },
      })
    );
    expect(display?.detail).toBe("2 terminy: 15.07.2026 · 22.07.2026");
  });

  it("pokazuje blok w rozwinięciu dla zamówienia z ETA", () => {
    expect(shouldShowMyOrderExpandedDeliveryTiming(row(), true)).toBe(true);
    expect(shouldShowMyOrderExpandedDeliveryTiming(row(), false)).toBe(false);
    expect(shouldShowMyOrderExpandedDeliveryTiming(row({ kind: "informacja" }), true)).toBe(
      false
    );
    expect(
      shouldShowMyOrderExpandedDeliveryTiming(
        row({ acknowledgeMode: "pickup", pickupPendingCount: 1 }),
        true
      )
    ).toBe(false);
  });

  it("pokazuje blok ZD dla informacja bez showProgress", () => {
    const zdFulfillment = {
      deadline: "2026-07-15",
      dokNr: "ZD/1/2026",
      syncedAt: null,
      source: "zd" as const,
    };
    expect(
      shouldShowMyOrderExpandedDeliveryTiming(
        row({ kind: "informacja", zdFulfillment, timingLabel: "15.07.2026 · ZD/1/2026", statusTitle: "Oczekiwanie na magazyn" }),
        false
      )
    ).toBe(true);
    expect(
      shouldShowMyOrderExpandedDeliveryTiming(
        row({ kind: "informacja", zdFulfillment, statusTitle: "Dostępne" }),
        false
      )
    ).toBe(false);
  });

  it("ukrywa planowaną dostawę w sekcji potwierdzenia odbioru", () => {
    expect(
      shouldShowMyOrderCollapsedDeliveryTiming({
        acknowledgeMode: "pickup",
        pickupPendingCount: 2,
        cancelledAckOrderIds: [],
        cancelNoticeOrderIds: [],
        zdFulfillment: null,
      })
    ).toBe(false);
    expect(
      shouldShowMyOrderCollapsedDeliveryTiming({
        acknowledgeMode: "availability",
        pickupPendingCount: 1,
        cancelledAckOrderIds: [],
        cancelNoticeOrderIds: [],
        zdFulfillment: null,
      })
    ).toBe(false);
    expect(
      shouldShowMyOrderCollapsedDeliveryTiming({
        acknowledgeMode: "none",
        pickupPendingCount: 0,
        cancelledAckOrderIds: [],
        cancelNoticeOrderIds: [],
        zdFulfillment: null,
      })
    ).toBe(true);
  });

  it("pokazuje termin ZD przy zamówieniu oczekującym na dostawę", () => {
    expect(
      shouldShowMyOrderCollapsedDeliveryTiming({
        acknowledgeMode: "none",
        pickupPendingCount: 0,
        cancelledAckOrderIds: [],
        cancelNoticeOrderIds: [],
        zdFulfillment: {
          deadline: "2026-06-26",
          dokNr: "ZD 1/M/06/2026",
          syncedAt: null,
          source: "zd",
        },
      })
    ).toBe(true);
  });
});
