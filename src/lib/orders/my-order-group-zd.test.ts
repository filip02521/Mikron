import { describe, expect, it } from "vitest";
import { presentMyOrders } from "./my-order-presenter";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

const stats: DeliveryStats[] = [
  {
    supplier_id: "marrodent",
    main_sum: 12,
    main_avg: 3,
    main_count: 4,
    side_sum: null,
    side_avg: null,
    side_count: null,
  },
];

function marrodentOrder(
  id: string,
  symbol: string,
  products: string,
  zd?: Partial<IndividualOrder>
): IndividualOrder {
  return {
    id,
    supplier_id: "marrodent",
    sales_person_id: "sp1",
    symbol,
    products,
    quantity: "4",
    delivered_quantity: "0",
    order_type: "Poboczne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-06-05T10:00:00+02:00",
    ordered_at: "2026-06-05T10:00:00+02:00",
    delivery_at: null,
    supplier: {
      id: "marrodent",
      name: "Marrodent",
      stats_mode: "LACZNIE",
      subiekt_kh_id: 9001,
    } as IndividualOrder["supplier"],
    ...zd,
  };
}

describe("presentMyOrders group ZD", () => {
  it("pokazuje termin ZD z drugiej pozycji gdy reprezentant go nie ma", () => {
    const row = presentMyOrders(
      [
        marrodentOrder("a", "-", "Komet węglik H364RNF"),
        marrodentOrder("b", "-", "Komet węglik H364RXE", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_dok_nr: "ZD/12/2026",
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
      ],
      stats
    ).zamowienia[0]!;

    expect(row.lineCount).toBe(2);
    expect(row.timingLabel).toContain("ZD/12/2026");
    expect(row.zdFulfillment?.dokNr).toBe("ZD/12/2026");
    expect(row.lines[1]?.zdFulfillment?.dokNr).toBe("ZD/12/2026");
  });

  it("pokazuje pending na karcie grupy gdy część pozycji czeka na termin ZD", () => {
    const row = presentMyOrders(
      [
        marrodentOrder("a", "-", "Komet węglik H364RNF"),
        marrodentOrder("b", "-", "Komet węglik H364RXE", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_dok_nr: "ZD/12/2026",
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
      ],
      stats
    ).zamowienia[0]!;

    expect(row.zdFulfillment?.dokNr).toBe("ZD/12/2026");
    expect(row.zdEtaPending).toBe(true);
    expect(row.zdEtaNoMatch).toBe(false);
  });

  it("pokazuje brak terminu ZD po sync bez dopasowania (Marrodent H364RNF)", () => {
    const row = presentMyOrders(
      [
        marrodentOrder("a", "H364RNF 103 015", "Komet węglik na prostnicę H364RNF 103 015", {
          zd_fulfillment_synced_at: "2026-06-18T14:20:40.887Z",
        }),
      ],
      stats
    ).zamowienia[0]!;

    expect(row.zdFulfillment).toBeNull();
    expect(row.zdEtaPending).toBe(false);
    expect(row.zdEtaNoMatch).toBe(true);
    expect(row.timingLabel).toMatch(/^ok\./);
  });

  it("nie duplikuje Marrodent — Zamowione i częściowa dostawa w jednej karcie", () => {
    const rows = presentMyOrders(
      [
        marrodentOrder("a", "H364RNF 103 015", "Komet węglik H364RNF 103 015", {
          status: "Zamowione",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-10",
          zd_fulfillment_dok_nr: "ZD 31/M/06/2026",
        }),
        marrodentOrder("b", "H364RXE 103 015", "Komet węglik H364RXE 103 015", {
          status: "Czesciowo_zrealizowane",
          delivered_quantity: "2",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-10",
          zd_fulfillment_dok_nr: "ZD 31/M/06/2026",
        }),
      ],
      stats
    ).zamowienia;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.lineCount).toBe(2);
    expect(rows[0]?.statusTitle).toBe("Częściowo na magazynie");
    expect(rows[0]?.zdFulfillment?.deadline).toBe("2026-07-10");
  });

  it("pokazuje oba terminy ZD gdy pozycje mają różne daty", () => {
    const row = presentMyOrders(
      [
        marrodentOrder("a", "A", "Produkt A", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-22",
          zd_fulfillment_dok_nr: "ZD 78/M/02/2026",
        }),
        marrodentOrder("b", "B", "Produkt B", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-15",
          zd_fulfillment_dok_nr: "ZD 36/M/02/2026",
        }),
      ],
      stats
    ).zamowienia[0]!;

    expect(row.lineCount).toBe(2);
    expect(row.zdFulfillment?.slots).toHaveLength(2);
    expect(row.timingLabel).toContain("15.07.2026");
    expect(row.timingLabel).toContain("ZD 36/M/02/2026");
    expect(row.timingLabel).not.toContain("22.07.2026");
    expect(row.timingLabel).not.toContain("2 terminy");
  });

  it("nadaje szacunek z historii pozycjom bez terminu ZD w grupie mieszanej", () => {
    const row = presentMyOrders(
      [
        marrodentOrder("a", "A", "Produkt A", {
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
        marrodentOrder("b", "B", "Produkt B", {
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-06-24",
          zd_fulfillment_dok_nr: "ZD 173/M/06/2026",
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
      ],
      stats
    ).zamowienia[0]!;

    expect(row.zdFulfillment?.deadline).toBe("2026-06-24");
    expect(row.zdEtaNoMatch).toBe(true);
    expect(row.lines[0]?.zdEtaNoMatch).toBe(true);
    expect(row.lines[0]?.zdFulfillment).toBeNull();
    expect(row.lines[0]?.historyEstimateLabel).toMatch(/^ok\./);
    expect(row.lines[1]?.zdFulfillment?.deadline).toBe("2026-06-24");
    expect(row.lines[1]?.historyEstimateLabel).toBeNull();
  });

  it("nie pokazuje terminu ZD dla pozycji do odbioru z regału", () => {
    const row = presentMyOrders(
      [
        marrodentOrder("pickup", "A", "Produkt A", {
          status: "Zrealizowane",
          delivered_quantity: "4",
          zd_fulfillment_source: "zd",
          zd_fulfillment_deadline: "2026-07-10",
          zd_fulfillment_dok_nr: "ZD/31/2026",
          zd_fulfillment_synced_at: "2026-06-18T08:00:00Z",
        }),
      ],
      stats
    ).zamowienia[0]!;

    expect(row.statusTitle).toBe("Do odbioru");
    expect(row.acknowledgeMode).toBe("pickup");
    expect(row.timingLabel).toBeNull();
    expect(row.zdFulfillment).toBeNull();
    expect(row.zdEtaNoMatch).toBe(false);
    expect(row.zdEtaPending).toBe(false);
  });
});
