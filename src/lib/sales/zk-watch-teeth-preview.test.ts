import { describe, expect, it } from "vitest";
import { buildZkTeethPreviewRows } from "./zk-watch-teeth-preview";
import type { ZkTeethOrder } from "./zk-watch-order-link";

const baseOrder: ZkTeethOrder = {
  id: "order-1",
  sales_person_id: "sp-1",
  sales_client_name: "Klinika Test",
  sales_client_kh_id: 100,
  source_zk_watch_id: "watch-1",
  source_zk_number: "ZK/1/2026",
  subiekt_tw_id: 10,
  symbol: "ABC",
  products: "Ząb testowy",
  mikran_code: null,
  quantity: "2",
  delivered_quantity: "0",
  status: "Zamowione",
  request_kind: "zamowienie",
  is_teeth: true,
  teeth_ordered_at: "2026-07-01T08:00:00Z",
  teeth_delivery_date: "2026-07-15",
  ordered_at: "2026-07-01T08:00:00Z",
  action_at: "2026-06-01T08:00:00Z",
  delivery_at: null,
  zd_fulfillment_deadline: null,
  zd_fulfillment_previous_deadline: null,
  zd_fulfillment_deadline_changed_at: null,
  zd_fulfillment_deadline_change_seen_at: null,
  sales_acknowledged_at: null,
  sales_cancelled_at: null,
};

describe("buildZkTeethPreviewRows", () => {
  it("buduje wiersze z detail zębów", () => {
    const rows = buildZkTeethPreviewRows([baseOrder], new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.statusLabel).toBe("Zamówione u dostawcy");
    expect(rows[0]?.statusTone).toBe("ordered");
  });

  it("pokazuje 'Czeka na zamówienie' gdy brak ordered_at", () => {
    const rows = buildZkTeethPreviewRows(
      [{ ...baseOrder, status: "Nowe", teeth_ordered_at: null, ordered_at: null }],
      new Map()
    );
    expect(rows[0]?.statusLabel).toBe("Czeka na zamówienie");
    expect(rows[0]?.statusTone).toBe("pending");
  });

  it("pokazuje 'Przyjęte — czeka na odbiór' gdy zrealizowane bez ack", () => {
    const rows = buildZkTeethPreviewRows(
      [{ ...baseOrder, status: "Zrealizowane", delivered_quantity: "2" }],
      new Map()
    );
    expect(rows[0]?.statusLabel).toBe("Przyjęte — czeka na odbiór");
    expect(rows[0]?.statusTone).toBe("delivered");
  });

  it("pokazuje 'Odebrane' gdy zrealizowane z ack", () => {
    const rows = buildZkTeethPreviewRows(
      [
        {
          ...baseOrder,
          status: "Zrealizowane",
          delivered_quantity: "2",
          sales_acknowledged_at: "2026-07-20T10:00:00Z",
        },
      ],
      new Map()
    );
    expect(rows[0]?.statusLabel).toBe("Odebrane");
    expect(rows[0]?.statusTone).toBe("acknowledged");
  });

  it("pokazuje 'Anulowane' przy procurement cancel (status=Anulowane, brak sales_cancelled_at)", () => {
    const rows = buildZkTeethPreviewRows(
      [{ ...baseOrder, status: "Anulowane" }],
      new Map()
    );
    expect(rows[0]?.statusLabel).toBe("Anulowane");
    expect(rows[0]?.statusTone).toBe("pending");
  });

  it("pokazuje 'Anulowane' przy pełnym sales cancel (oba: sales_cancelled_at + sales_acknowledged_at)", () => {
    const rows = buildZkTeethPreviewRows(
      [
        {
          ...baseOrder,
          status: "Anulowane",
          sales_cancelled_at: "2026-06-20T10:00:00Z",
          sales_acknowledged_at: "2026-06-20T10:00:00Z",
        },
      ],
      new Map()
    );
    expect(rows[0]?.statusLabel).toBe("Anulowane");
    expect(rows[0]?.statusTone).toBe("pending");
  });

  it("pokazuje 'Anulowane' przy częściowym sales cancel (sales_cancelled_at bez sales_acknowledged_at)", () => {
    const rows = buildZkTeethPreviewRows(
      [
        {
          ...baseOrder,
          status: "Anulowane",
          sales_cancelled_at: "2026-06-20T10:00:00Z",
        },
      ],
      new Map()
    );
    expect(rows[0]?.statusLabel).toBe("Anulowane");
    expect(rows[0]?.statusTone).toBe("pending");
  });
});
