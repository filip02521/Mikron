import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import { presentMyOrders } from "./my-order-presenter";
import type { IndividualOrder } from "@/types/database";
import {
  partitionMyOrderRowsBySalesAction,
  rowNeedsSalesAction,
} from "@/lib/orders/my-order-inbox-filter";

function row(partial: Partial<MyOrderRow> & Pick<MyOrderRow, "id">): MyOrderRow {
  const { id, ...rest } = partial;
  return {
    id,
    kind: "zamowienie",
    requestKind: "zamowienie",
    statusTitle: "Zamówione",
    statusDetail: null,
    submittedLabel: "2026-01-01",
    clientLabel: null,
    lineCount: 1,
    pickupPendingCount: 0,
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    acknowledgeMode: null,
    timingLabel: null,
    progressLabel: null,
    headline: "Czekamy",
    headlineTone: "neutral",
    subline: null,
    rowColor: "white",
    badgeVariant: "blue",
    ...rest,
  } as MyOrderRow;
}

const baseOrder: IndividualOrder = {
  id: "1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "3",
  delivered_quantity: "2",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Czesciowo_zrealizowane",
  action_at: "2026-04-28",
  ordered_at: "2026-05-01",
  delivery_at: null,
  supplier: {
    id: "sup1",
    name: "Dostawca X",
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

describe("rowNeedsSalesAction", () => {
  it("true przy odbiorze", () => {
    expect(
      rowNeedsSalesAction(
        row({
          id: "1",
          acknowledgeMode: "pickup",
          pickupPendingCount: 1,
          statusTitle: "Do odbioru",
        })
      )
    ).toBe(true);
  });

  it("false przy zamówionym bez akcji", () => {
    expect(rowNeedsSalesAction(row({ id: "2", statusTitle: "Zamówione" }))).toBe(false);
  });

  it("false przy częściowej dostawie bez pełnego odbioru", () => {
    const partial = presentMyOrders([baseOrder], []).zamowienia[0]!;
    expect(rowNeedsSalesAction(partial)).toBe(false);
  });

  it("false przy częściowej dostawie w tranzycie", () => {
    const partialTransit = presentMyOrders(
      [{ ...baseOrder, delivered_quantity: "0" }],
      []
    ).zamowienia[0]!;
    expect(partialTransit.statusTitle).toBe("Częściowo na magazynie");
    expect(rowNeedsSalesAction(partialTransit)).toBe(false);
  });
});

describe("partitionMyOrderRowsBySalesAction", () => {
  it("dzieli listę na potwierdzenie i resztę", () => {
    const a = row({
      id: "a",
      acknowledgeMode: "pickup",
      pickupPendingCount: 1,
      statusTitle: "Do odbioru",
    });
    const b = row({ id: "b", statusTitle: "Zamówione" });
    const { needsAction, inProgress } = partitionMyOrderRowsBySalesAction([b, a]);
    expect(needsAction.map((r) => r.id)).toEqual(["a"]);
    expect(inProgress.map((r) => r.id)).toEqual(["b"]);
  });
});
