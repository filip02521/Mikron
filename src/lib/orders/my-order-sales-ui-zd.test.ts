import { describe, expect, it } from "vitest";
import {
  resolveZdEtaNoMatchFromOrder,
  resolveZdEtaPendingFromOrder,
  resolveZdFulfillmentFromOrder,
  salesZdTimingLabel,
  aggregateGroupZdEtaState,
} from "./my-order-sales-ui";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

const stats = {
  supplier_id: "s1",
  main_sum: 50,
  main_avg: 5,
  main_count: 10,
  side_sum: 6,
  side_avg: 3,
  side_count: 2,
} as DeliveryStats;

function overdueOrder(
  overrides: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id: "o1",
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "A",
    products: "Prod",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-01-02T10:00:00+01:00",
    ordered_at: "2026-01-02T10:00:00+01:00",
    delivery_at: null,
    supplier: {
      id: "s1",
      name: "Dostawca",
      stats_mode: "LACZNIE",
      subiekt_kh_id: 100,
    } as IndividualOrder["supplier"],
    ...overrides,
  };
}

describe("resolveZdEtaPendingFromOrder", () => {
  it("pokazuje pending gdy brak sync i zamówienie po terminie", () => {
    expect(resolveZdEtaPendingFromOrder(overdueOrder(), stats, "LACZNIE")).toBe(
      true
    );
  });

  it("nie pokazuje pending gdy Subiekt niedostępny", () => {
    expect(
      resolveZdEtaPendingFromOrder(overdueOrder(), stats, "LACZNIE", undefined, false)
    ).toBe(false);
  });

  it("pokazuje pending gdy dostawca ma tylko alias kh_Id", () => {
    expect(
      resolveZdEtaPendingFromOrder(
        overdueOrder({
          supplier: {
            id: "s1",
            name: "Dostawca alias",
            stats_mode: "LACZNIE",
            subiekt_kh_id: null,
          } as IndividualOrder["supplier"],
        }),
        stats,
        "LACZNIE",
        { s1: [200, 300] }
      )
    ).toBe(true);
  });

  it("nie pokazuje pending po synchronizacji", () => {
    expect(
      resolveZdEtaPendingFromOrder(
        overdueOrder({
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
        stats,
        "LACZNIE"
      )
    ).toBe(false);
  });

  it("pokazuje brak dopasowania po synchronizacji bez terminu ZD", () => {
    expect(
      resolveZdEtaNoMatchFromOrder(
        overdueOrder({
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
        stats,
        "LACZNIE"
      )
    ).toBe(true);
  });

  it("nie pokazuje pending gdy termin ZD już zapisany", () => {
    expect(
      resolveZdEtaPendingFromOrder(
        overdueOrder({
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-03",
          zd_fulfillment_dok_nr: "ZD/1/2026",
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
        stats,
        "LACZNIE"
      )
    ).toBe(false);
  });
});

describe("resolveZdFulfillmentFromOrder", () => {
  it("akceptuje termin ZD bez numeru dokumentu", () => {
    const zd = resolveZdFulfillmentFromOrder({
      zd_fulfillment_source: "zd",
      zd_fulfillment_deadline: "2026-07-03",
      zd_fulfillment_dok_nr: null,
      zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
    });
    expect(zd?.deadline).toBe("2026-07-03");
    expect(zd?.dokNr).toBe("ZD");
  });
});

describe("aggregateGroupZdEtaState", () => {
  it("wybiera termin ZD z dowolnej pozycji grupy", () => {
    const result = aggregateGroupZdEtaState(
      [
        overdueOrder({ id: "a" }),
        overdueOrder({
          id: "b",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-20",
          zd_fulfillment_dok_nr: "ZD/9/2026",
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
      ],
      { s1: stats }
    );
    expect(result.zdFulfillment?.dokNr).toBe("ZD/9/2026");
    expect(result.zdEtaPending).toBe(true);
  });
});

describe("salesZdTimingLabel", () => {
  it("formatuje termin z numerem ZD", () => {
    expect(salesZdTimingLabel("2026-07-03", "ZD/81/2026", false)).toBe(
      "do 03.07.2026 · ZD/81/2026"
    );
  });

  it("dodaje po terminie gdy opóźnione", () => {
    expect(salesZdTimingLabel("2026-07-03", "ZD/81/2026", true)).toContain(
      "po terminie"
    );
  });
});
