import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { formatDateString } from "./dates";
import type { MyOrderRow } from "./my-order-presenter";
import {
  formatCollapsedDeliveryTimingLabel,
  myOrderCollapsedMobileTiming,
} from "./my-order-collapsed-mobile-timing";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { createTestMyOrderRow } from "./test-fixtures";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return createTestMyOrderRow({ timingLabel: "ok. 10.05.2026 (~5 dni rob.)", ...extra });
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
