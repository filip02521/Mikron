import { describe, expect, it } from "vitest";
import { aggregateGroupZdEtaState } from "./my-order-sales-ui";
import {
  buildCollapsedZdMixedNoMatchHint,
  buildCollapsedZdMultiSlotHint,
  salesZdGroupTimingLabel,
  salesZdPrimarySlotTimingLabel,
  zdFulfillmentCollapsedCaption,
  zdFulfillmentSlots,
  ZD_DELIVERY_META_CAPTION,
} from "./my-order-zd-fulfillment-display";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

const stats: DeliveryStats = {
  supplier_id: "s1",
  main_sum: 12,
  main_avg: 3,
  main_count: 4,
  side_sum: null,
  side_avg: null,
  side_count: null,
};

function order(
  id: string,
  extra: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id,
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "A",
    products: `Prod ${id}`,
    quantity: "1",
    delivered_quantity: "0",
    order_type: "Poboczne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-06-05T10:00:00+02:00",
    ordered_at: "2026-06-05T10:00:00+02:00",
    delivery_at: null,
    supplier: {
      id: "s1",
      name: "Dostawca",
      stats_mode: "LACZNIE",
      subiekt_kh_id: 9001,
    } as IndividualOrder["supplier"],
    ...extra,
  };
}

describe("aggregateGroupZdEtaState slots", () => {
  it("grupuje różne terminy ZD w slots zamiast (+N poz.)", () => {
    const result = aggregateGroupZdEtaState(
      [
        order("a", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-22",
          zd_fulfillment_dok_nr: "ZD 78/M/02/2026",
        }),
        order("b", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_dok_nr: "ZD 36/M/02/2026",
        }),
      ],
      { s1: stats }
    );

    expect(result.zdFulfillment?.deadline).toBe("2026-07-15");
    expect(result.zdFulfillment?.dokNr).toBe("ZD 36/M/02/2026");
    expect(result.zdFulfillment?.slots).toEqual([
      {
        deadline: "2026-07-15",
        dokNr: "ZD 36/M/02/2026",
        count: 1,
        pendingConfirmation: false,
      },
      {
        deadline: "2026-07-22",
        dokNr: "ZD 78/M/02/2026",
        count: 1,
        pendingConfirmation: false,
      },
    ]);
  });

  it("oznacza placeholder gdy termin ZD = dzień złożenia u dostawcy", () => {
    const result = aggregateGroupZdEtaState(
      [
        order("a", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-06-05",
          zd_fulfillment_dok_nr: "ZD 1/M/06/2026",
        }),
      ],
      { s1: stats }
    );

    expect(result.zdFulfillment?.pendingConfirmation).toBe(true);
  });

  it("nie dodaje slots przy jednym terminie", () => {
    const result = aggregateGroupZdEtaState(
      [
        order("a", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_dok_nr: "ZD 36/M/02/2026",
        }),
        order("b", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_dok_nr: "ZD 36/M/02/2026",
        }),
      ],
      { s1: stats }
    );

    expect(result.zdFulfillment?.slots).toBeUndefined();
  });
});

describe("salesZdPrimarySlotTimingLabel", () => {
  it("pokazuje tylko najwcześniejszy termin", () => {
    const fulfillment = {
      deadline: "2026-07-15",
      dokNr: "ZD/1",
      slots: [
        { deadline: "2026-07-15", dokNr: "ZD/1", count: 1 },
        { deadline: "2026-07-22", dokNr: "ZD/2", count: 1 },
      ],
    };
    expect(salesZdPrimarySlotTimingLabel(fulfillment, false)).toBe(
      "do 15.07.2026 · ZD/1"
    );
  });
});

describe("buildCollapsedZdMultiSlotHint", () => {
  it("wymienia produkty z najszybszą dostawą i zachęca do rozwinięcia", () => {
    const fulfillment = {
      deadline: "2026-07-15",
      dokNr: "ZD/1",
      syncedAt: null,
      source: "zd" as const,
      slots: [
        { deadline: "2026-07-15", dokNr: "ZD/1", count: 1 },
        { deadline: "2026-07-22", dokNr: "ZD/2", count: 1 },
      ],
    };
    const hint = buildCollapsedZdMultiSlotHint(fulfillment, [
      {
        product: "Produkt A",
        zdFulfillment: { deadline: "2026-07-15", dokNr: "ZD/1", syncedAt: null, source: "zd" },
      },
      {
        product: "Produkt B",
        zdFulfillment: { deadline: "2026-07-22", dokNr: "ZD/2", syncedAt: null, source: "zd" },
      },
    ]);
    expect(hint).toBe(
      "Najszybsza dostawa: Produkt A — rozwiń po 1 późniejszy termin"
    );
  });
});

describe("buildCollapsedZdMixedNoMatchHint", () => {
  it("zachęca do rozwinięcia po szacunek z historii", () => {
    const hint = buildCollapsedZdMixedNoMatchHint([
      { zdEtaNoMatch: true, historyEstimateLabel: "ok. 22.06.2026 (~5 dni rob.)" },
      { zdEtaNoMatch: true, historyEstimateLabel: "ok. 22.06.2026 (~5 dni rob.)" },
      { zdFulfillment: { deadline: "2026-06-24", dokNr: "ZD/1", syncedAt: null, source: "zd" } },
    ]);
    expect(hint).toBe("2 pozycje bez terminu w ZD — rozwiń po szacunek z historii");
  });
});

describe("zdFulfillmentCollapsedCaption", () => {
  it("dodaje liczbę terminów przy wielu slotach", () => {
    expect(zdFulfillmentCollapsedCaption(1)).toBe("Planowana dostawa");
    expect(zdFulfillmentCollapsedCaption(2)).toBe("Planowana dostawa · 2 terminy");
    expect(zdFulfillmentCollapsedCaption(5)).toBe("Planowana dostawa · 5 terminów");
  });

  it("przy przeterminowaniu używa etykiety Termin u dostawcy", () => {
    expect(zdFulfillmentCollapsedCaption(1, { overdue: true })).toBe("Termin u dostawcy");
    expect(zdFulfillmentCollapsedCaption(3, { overdue: true })).toBe(
      "Termin u dostawcy · 3 terminy"
    );
  });
});

describe("salesZdGroupTimingLabel", () => {
  it("formatuje dwa różne terminy", () => {
    const slots = zdFulfillmentSlots({
      deadline: "2026-07-15",
      dokNr: "ZD/1",
      slots: [
        { deadline: "2026-07-15", dokNr: "ZD/1", count: 1 },
        { deadline: "2026-07-22", dokNr: "ZD/2", count: 1 },
      ],
    });
    expect(salesZdGroupTimingLabel(slots, false)).toBe(
      "2 terminy: 15.07.2026 i 22.07.2026"
    );
  });
});

describe("ZD_DELIVERY_META_CAPTION", () => {
  it("używa etykiety Planowana dostawa", () => {
    expect(ZD_DELIVERY_META_CAPTION).toBe("Planowana dostawa");
  });
});
