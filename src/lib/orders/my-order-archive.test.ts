import { describe, expect, it } from "vitest";
import {
  ARCHIVE_RECENT_DAYS,
  presentArchivedMyOrders,
} from "./my-order-archive";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

function order(
  id: string,
  ackAt: string,
  status: IndividualOrder["status"] = "Zrealizowane"
): IndividualOrder {
  return {
    id,
    supplier_id: "sup1",
    sales_person_id: "sp1",
    symbol: "A",
    products: "Produkt",
    quantity: "1",
    delivered_quantity: "1",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status,
    action_at: "2026-05-01",
    ordered_at: "2026-05-01",
    delivery_at: "2026-05-10",
    sales_acknowledged_at: ackAt,
    supplier: {
      id: "sup1",
      name: "Dostawca",
      location: "POLSKA",
      pickup_mikran: false,
      pickup_pallet: false,
      notes: "",
      mails: "",
      extra_info: "",
      interval_raw: null,
      interval_weeks: null,
      stock_raw: null,
      stock: null,
      stats_mode: "LACZNIE",
      order_on_demand: false,
      is_active: true,
    },
  };
}

describe("presentArchivedMyOrders", () => {
  it("filtruje do ostatnich N dni (Warszawa)", () => {
    const since = warsawDateKeyDaysAgo(ARCHIVE_RECENT_DAYS);
    const oldAck = `${since}T08:00:00.000Z`;
    const dayBefore = warsawDateKeyDaysAgo(ARCHIVE_RECENT_DAYS + 1);

    const rows = presentArchivedMyOrders(
      [
        order("new", `${since}T12:00:00.000Z`),
        order("old", `${dayBefore}T12:00:00.000Z`),
      ],
      [] as DeliveryStats[],
      { acknowledgedSince: since }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("new");
    expect(oldAck).toBeTruthy();
  });
});
