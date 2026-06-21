import { describe, expect, it } from "vitest";
import {
  buildPlaceholderZdDeliveryDateMetaDisplay,
  buildZdDeliveryDateMetaDisplay,
  isPlaceholderZdFulfillmentDeadline,
  resolvePlaceholderZdFulfillmentDeadlineFromOrder,
  ZD_FULFILLMENT_PLACEHOLDER_PRIMARY_LABEL,
} from "@/lib/orders/zd-fulfillment-placeholder-deadline";
import { parseDateOnly } from "@/lib/orders/dates";

describe("isPlaceholderZdFulfillmentDeadline", () => {
  it("traktuje ten sam dzień co ordered_at jako placeholder bez korekty", () => {
    expect(
      isPlaceholderZdFulfillmentDeadline({
        deadline: "2026-06-18",
        placementAt: "2026-06-18T09:15:00Z",
      })
    ).toBe(true);
  });

  it("ufa terminowi po korekcie działu dostaw", () => {
    expect(
      isPlaceholderZdFulfillmentDeadline({
        deadline: "2026-06-18",
        placementAt: "2026-06-18T09:15:00Z",
        deadlineChangedAt: "2026-06-19T08:00:00Z",
      })
    ).toBe(false);
  });

  it("nie blokuje terminu w innym dniu niż złożenie", () => {
    expect(
      isPlaceholderZdFulfillmentDeadline({
        deadline: "2026-06-20",
        placementAt: "2026-06-18T09:15:00Z",
      })
    ).toBe(false);
  });
});

describe("buildZdDeliveryDateMetaDisplay", () => {
  it("zamiast Dziś pokazuje komunikat oczekiwania na termin", () => {
    const display = buildZdDeliveryDateMetaDisplay(parseDateOnly("2026-06-18")!, {
      todayDateKey: "2026-06-18",
      placementAt: "2026-06-18T10:00:00Z",
    });

    expect(display.primaryLabel).toBe(ZD_FULFILLMENT_PLACEHOLDER_PRIMARY_LABEL);
    expect(display.primaryLabel).not.toBe("Dziś");
  });

  it("pokazuje Dziś gdy termin różni się od dnia złożenia", () => {
    const display = buildZdDeliveryDateMetaDisplay(parseDateOnly("2026-06-18")!, {
      todayDateKey: "2026-06-18",
      placementAt: "2026-06-17T10:00:00Z",
    });

    expect(display.primaryLabel).toBe("Dziś");
  });
});

describe("resolvePlaceholderZdFulfillmentDeadlineFromOrder", () => {
  it("używa ordered_at jako dnia złożenia", () => {
    expect(
      resolvePlaceholderZdFulfillmentDeadlineFromOrder({
        zd_fulfillment_deadline: "2026-06-18",
        ordered_at: "2026-06-18T08:00:00Z",
        action_at: "2026-06-10T08:00:00Z",
        status: "Zamowione",
        zd_fulfillment_deadline_changed_at: null,
      })
    ).toBe(true);
  });
});

describe("buildPlaceholderZdDeliveryDateMetaDisplay", () => {
  it("ma tytuł podpowiedzi dla handlowca", () => {
    expect(buildPlaceholderZdDeliveryDateMetaDisplay().title).toContain("Dział dostaw");
  });

  it("trzyma krótki detail pod wąską kolumnę meta", () => {
    expect(buildPlaceholderZdDeliveryDateMetaDisplay().detailLabel!.length).toBeLessThanOrEqual(28);
  });
});
