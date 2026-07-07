import { describe, expect, it } from "vitest";
import {
  buildTeethReceiveQueue,
  groupTeethReceiveQueueBySupplier,
  isTeethReceiveOrder,
  partitionDeliveryOrdersByTeeth,
  sortTeethReceiveOrders,
  summarizeTeethReceiveInbox,
  teethReceiveSalesPersonStripeIndex,
} from "./receive-queue-teeth";
import type { IndividualOrder } from "@/types/database";

function order(extra: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "sp",
    symbol: "A",
    products: "P",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-05-01",
    ordered_at: "2026-05-01",
    delivery_at: null,
    ...extra,
  };
}

describe("receive-queue-teeth", () => {
  it("rozdziela zęby od zwykłych zamówień", () => {
    const teeth = order({ id: "t", is_teeth: true });
    const regular = order({ id: "r" });
    const { regular: r, teeth: t } = partitionDeliveryOrdersByTeeth([teeth, regular]);
    expect(r.map((o) => o.id)).toEqual(["r"]);
    expect(t.map((o) => o.id)).toEqual(["t"]);
  });

  it("nie traktuje informacji jako zębów w kolejce przyjęcia", () => {
    expect(
      isTeethReceiveOrder(
        order({ is_teeth: true, request_kind: "informacja", quantity: "-" })
      )
    ).toBe(false);
  });

  it("liczy aktywną kolejkę zębów", () => {
    const s = summarizeTeethReceiveInbox([
      order({ id: "a", is_teeth: true }),
      order({ id: "b", is_teeth: true, status: "Czesciowo_zrealizowane" }),
      order({ id: "c" }),
    ]);
    expect(s.activeCount).toBe(2);
    expect(s.partialCount).toBe(1);
  });

  it("buduje kolejkę tylko z pozycji zębowych", () => {
    const queue = buildTeethReceiveQueue([
      order({ id: "t", is_teeth: true, supplier: { id: "s", name: "Lab" } as IndividualOrder["supplier"] }),
      order({ id: "r" }),
    ]);
    expect(queue.map((o) => o.id)).toEqual(["t"]);
  });

  it("nie pokazuje w pełni dostarczonych pozycji w kolejce", () => {
    const queue = buildTeethReceiveQueue([
      order({ id: "done", is_teeth: true, status: "Zrealizowane", delivered_quantity: "3", quantity: "3" }),
      order({ id: "pending", is_teeth: true, status: "Zamowione" }),
    ]);
    expect(queue.map((o) => o.id)).toEqual(["pending"]);
  });

  it("nie pokazuje pozycji częściowo zrealizowanej gdy wszystkie linie zębowe są zamknięte", () => {
    const queue = buildTeethReceiveQueue([
      order({
        id: "lines-closed",
        is_teeth: true,
        status: "Czesciowo_zrealizowane",
        delivered_quantity: "3",
        quantity: "5",
        teeth_line_delivered: { "A1|W1|upper|anterior": 1, "A2|W2|lower|posterior": 2 },
        teeth_details: [
          { id: "d1", order_id: "lines-closed", position: 1, color: "A1", mould: "W1", jaw: "upper", kind: "anterior", size: null },
          { id: "d2", order_id: "lines-closed", position: 2, color: "A2", mould: "W2", jaw: "lower", kind: "posterior", size: null },
        ],
      }),
      order({ id: "pending", is_teeth: true, status: "Zamowione" }),
    ]);
    expect(queue.map((o) => o.id)).toEqual(["pending"]);
  });

  it("nie liczy w pełni dostarczonych pozycji w inbox", () => {
    const s = summarizeTeethReceiveInbox([
      order({ id: "done", is_teeth: true, status: "Zrealizowane", delivered_quantity: "3", quantity: "3" }),
      order({ id: "pending", is_teeth: true, status: "Zamowione" }),
    ]);
    expect(s.activeCount).toBe(1);
  });

  it("nie liczy pozycji częściowo zrealizowanej gdy wszystkie linie zębowe są zamknięte", () => {
    const s = summarizeTeethReceiveInbox([
      order({
        id: "lines-closed",
        is_teeth: true,
        status: "Czesciowo_zrealizowane",
        delivered_quantity: "3",
        quantity: "5",
        teeth_line_delivered: { "A1|W1|upper|anterior": 1, "A2|W2|lower|posterior": 2 },
        teeth_details: [
          { id: "d1", order_id: "lines-closed", position: 1, color: "A1", mould: "W1", jaw: "upper", kind: "anterior", size: null },
          { id: "d2", order_id: "lines-closed", position: 2, color: "A2", mould: "W2", jaw: "lower", kind: "posterior", size: null },
        ],
      }),
      order({ id: "pending", is_teeth: true, status: "Zamowione" }),
    ]);
    expect(s.activeCount).toBe(1);
  });

  it("sortuje w obrębie dostawcy po handlowcu", () => {
    const sorted = sortTeethReceiveOrders([
      order({
        id: "b",
        sales_person: { id: "sp2", name: "Zofia" } as IndividualOrder["sales_person"],
      }),
      order({
        id: "a",
        sales_person: { id: "sp1", name: "Adam" } as IndividualOrder["sales_person"],
      }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("grupuje po dostawcy i sortuje po handlowcu", () => {
    const groups = groupTeethReceiveQueueBySupplier([
      order({
        id: "1",
        supplier: { id: "s1", name: "Lab A" } as IndividualOrder["supplier"],
        sales_person: { id: "sp2", name: "Zofia" } as IndividualOrder["sales_person"],
      }),
      order({
        id: "2",
        supplier: { id: "s1", name: "Lab A" } as IndividualOrder["supplier"],
        sales_person: { id: "sp1", name: "Adam" } as IndividualOrder["sales_person"],
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.orders.map((o) => o.id)).toEqual(["2", "1"]);
  });

  it("przypisuje osobny indeks paska per handlowiec w grupie", () => {
    const orders = [
      order({
        id: "1",
        sales_person_id: "sp1",
        sales_person: { id: "sp1", name: "Adam" } as IndividualOrder["sales_person"],
      }),
      order({
        id: "2",
        sales_person_id: "sp1",
        sales_person: { id: "sp1", name: "Adam" } as IndividualOrder["sales_person"],
      }),
      order({
        id: "3",
        sales_person_id: "sp2",
        sales_person: { id: "sp2", name: "Zofia" } as IndividualOrder["sales_person"],
      }),
    ];
    expect(teethReceiveSalesPersonStripeIndex(orders, 0)).toBe(0);
    expect(teethReceiveSalesPersonStripeIndex(orders, 1)).toBe(0);
    expect(teethReceiveSalesPersonStripeIndex(orders, 2)).toBe(1);
  });
});
