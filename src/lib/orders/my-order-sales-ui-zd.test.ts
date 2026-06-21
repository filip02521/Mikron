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

  it("pokazuje przeterminowany termin ZD z bazy", () => {
    const at = new Date("2026-06-18T12:00:00+02:00");
    const zd = resolveZdFulfillmentFromOrder(
      {
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-02-27",
        zd_fulfillment_dok_nr: "ZD 78/M/02/2026",
        zd_fulfillment_synced_at: "2026-03-01T10:00:00+01:00",
      },
      at
    );
    expect(zd?.deadline).toBe("2026-02-27");
    expect(zd?.dokNr).toBe("ZD 78/M/02/2026");
  });

  it("dołącza widoczną zmianę terminu ZD", () => {
    const at = new Date("2026-06-18T12:00:00+02:00");
    const zd = resolveZdFulfillmentFromOrder(
      {
        zd_fulfillment_source: "zd",
        zd_fulfillment_deadline: "2026-07-22",
        zd_fulfillment_dok_nr: "ZD/1",
        zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        zd_fulfillment_previous_deadline: "2026-07-15",
        zd_fulfillment_deadline_changed_at: "2026-06-18T08:00:00Z",
        zd_fulfillment_deadline_change_seen_at: null,
      },
      at
    );
    expect(zd?.deadlineChange?.title).toBe("Termin przesunięty");
    expect(zd?.deadlineChange?.detail).toContain("15.07.2026");
  });
});

describe("przeterminowany termin ZD w bazie — łańcuch UI", () => {
  const at = new Date("2026-06-18T12:00:00+02:00");

  function expiredZdOrder(overrides: Partial<IndividualOrder> = {}): IndividualOrder {
    return overdueOrder({
      zd_fulfillment_source: "zd",
      zd_fulfillment_deadline: "2026-02-27",
      zd_fulfillment_dok_nr: "ZD 78/M/02/2026",
      zd_fulfillment_synced_at: "2026-03-01T10:00:00+01:00",
      ...overrides,
    });
  }

  it("pokazuje zapisany termin w meta ZD", () => {
    const zd = resolveZdFulfillmentFromOrder(expiredZdOrder(), at);
    expect(zd?.deadline).toBe("2026-02-27");
    expect(salesZdTimingLabel(zd!.deadline, zd!.dokNr, true)).toContain("po terminie");
  });

  it("nie wraca do stanu pending po wcześniejszym syncu", () => {
    expect(
      resolveZdEtaPendingFromOrder(expiredZdOrder(), stats, "LACZNIE", undefined, true)
    ).toBe(false);
  });

  it("nie pokazuje „brak terminu” gdy w bazie jest wygasły ZD", () => {
    expect(resolveZdEtaNoMatchFromOrder(expiredZdOrder(), stats, "LACZNIE")).toBe(
      false
    );
  });

  it("przy Subiekcie offline nadal pokazuje wygasły termin, bez pending", () => {
    expect(
      resolveZdEtaPendingFromOrder(expiredZdOrder(), stats, "LACZNIE", undefined, false)
    ).toBe(false);
    expect(resolveZdFulfillmentFromOrder(expiredZdOrder(), at)?.deadline).toBe(
      "2026-02-27"
    );
    expect(resolveZdEtaNoMatchFromOrder(expiredZdOrder(), stats, "LACZNIE")).toBe(
      false
    );
  });

  it("agreguje wygasły termin w grupie zamiast noMatch", () => {
    const result = aggregateGroupZdEtaState([expiredZdOrder()], { s1: stats }, undefined, false);
    expect(result.zdFulfillment?.deadline).toBe("2026-02-27");
    expect(result.zdEtaNoMatch).toBe(false);
    expect(result.zdEtaPending).toBe(false);
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
