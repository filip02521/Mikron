import { describe, expect, it } from "vitest";
import {
  buildTeethReceiveFlatRows,
  buildTeethReceiveDeliveryUpdates,
  groupTeethReceiveByProductLine,
  lineQtyForOrder,
  teethReceiveClampManualSessionQty,
  teethReceiveClearSessionInputForOrders,
  teethReceiveFillSessionForOrders,
  teethReceiveRowMeta,
  teethReceiveRowKey,
} from "./teeth-receive-lines";
import { teethPanelReadinessContextFromMaps } from "@/lib/teeth/teeth-panel-order-readiness";
import type { IndividualOrder } from "@/types/database";

function order(extra: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "o1",
    supplier_id: "s",
    sales_person_id: "sp1",
    symbol: "A",
    products: "Zęby",
    quantity: "3",
    delivered_quantity: "0",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status: "Zamowione",
    action_at: "2026-05-01",
    ordered_at: "2026-05-01",
    delivery_at: null,
    sales_person: { id: "sp1", name: "Adam" } as IndividualOrder["sales_person"],
    teeth_details: [
      {
        id: "d1",
        order_id: "o1",
        position: 1,
        color: "A1",
        mould: "W1",
        jaw: "upper",
        kind: "anterior",
        size: null,
      },
      {
        id: "d2",
        order_id: "o1",
        position: 2,
        color: "A2",
        mould: "W2",
        jaw: "lower",
        kind: "posterior",
        size: null,
      },
    ],
    ...extra,
  };
}

describe("teeth-receive-lines", () => {
  it("spłaszcza zamówienie do wierszy specyfikacji", () => {
    const rows = buildTeethReceiveFlatRows([order()], () => true);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.kind).toBe("spec");
    expect(rows[0]!.salesPersonName).toBe("Adam");
  });

  it("pomija wiersze zębowe które są już kompletne", () => {
    const rows = buildTeethReceiveFlatRows(
      [
        order({
          delivered_quantity: "1",
          teeth_line_delivered: { "A1|W1|upper|anterior": 1 },
          status: "Czesciowo_zrealizowane",
        }),
      ],
      () => true,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("spec");
    expect(rows[0]!.rowKey).toBe("o1\0A2|W2|lower|posterior");
  });

  it("grupuje ilości z powrotem na zamówienie", () => {
    const rows = buildTeethReceiveFlatRows([order()], () => true);
    const flat = {
      [rows[0]!.rowKey]: "1",
      [rows[1]!.rowKey]: "1",
    };
    const byOrder = lineQtyForOrder("o1", flat);
    expect(Object.keys(byOrder)).toHaveLength(2);
    const updates = buildTeethReceiveDeliveryUpdates([order()], flat, {}, () => true);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.orderId).toBe("o1");
    expect(updates[0]!.qty).toBe("2");
    expect(updates[0]!.teethLineDelivered).toEqual({
      "A1|W1|upper|anterior": 1,
      "A2|W2|lower|posterior": 1,
    });
  });

  it("tworzy wiersz ręczny gdy brak kompletnej specyfikacji", () => {
    const rows = buildTeethReceiveFlatRows([order({ teeth_details: [] })], () => true);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("manual");
  });

  it("ogranicza ręczną ilość sesji do pozostałej", () => {
    expect(teethReceiveClampManualSessionQty(order({ quantity: "3" }), "9")).toBe("3");
    expect(
      buildTeethReceiveDeliveryUpdates(
        [order({ quantity: "3", teeth_details: [] })],
        {},
        { o1: "9" },
        () => false,
      ),
    ).toEqual([{ orderId: "o1", qty: "3" }]);
  });

  it("wypełnia sesję dla wielu zamówień", () => {
    const filled = teethReceiveFillSessionForOrders(
      [order(), order({ id: "o2", quantity: "2", teeth_details: [] })],
      {},
      {},
      (o) => o.id === "o1",
    );
    expect(Object.keys(filled.flatLineQty).length).toBeGreaterThan(0);
    expect(filled.manualQty.o2).toBe("2");
  });

  it("czyści wpisy sesji per zamówienie", () => {
    const rows = buildTeethReceiveFlatRows([order()], () => true);
    const cleared = teethReceiveClearSessionInputForOrders(
      ["o1"],
      { [rows[0]!.rowKey]: "1" },
      { o1: "1" },
    );
    expect(cleared.flatLineQty).toEqual({});
    expect(cleared.manualQty).toEqual({});
  });

  it("unikalny klucz wiersza", () => {
    expect(teethReceiveRowKey("o1", "A1|W1|upper|anterior")).toBe(
      "o1\0A1|W1|upper|anterior",
    );
  });

  it("liczy metadane wiersza zamówienia", () => {
    const rows = buildTeethReceiveFlatRows([order()], () => true);
    expect(teethReceiveRowMeta(rows, 0).isFirstInOrder).toBe(true);
    expect(teethReceiveRowMeta(rows, 0).orderRowSpan).toBe(2);
    expect(teethReceiveRowMeta(rows, 0).isNewSalesPerson).toBe(true);
    expect(teethReceiveRowMeta(rows, 0).salesPersonBlockLength).toBe(2);
  });

  it("grupuje po linii produktowej", () => {
    const ctx = teethPanelReadinessContextFromMaps({
      productLineByTwId: new Map(),
      manufacturerByTwId: new Map(),
      kindByTwId: new Map(),
    });
    const groups = groupTeethReceiveByProductLine(
      [
        order({
          products: "Phonares Typ II zęby przednie",
        }),
        order({
          id: "o2",
          products: "Wiedent Vita zęby",
        }),
      ],
      ctx,
    );
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.map((g) => g.productLineLabel).join("|")).toMatch(/Phonares|Vita|Wiedent/i);
  });
});
