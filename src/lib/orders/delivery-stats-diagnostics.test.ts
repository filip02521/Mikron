import { describe, expect, it } from "vitest";
import {
  aggregateDeliveryStatsFromOrders,
  hasSiblingDeliveryStatsSample,
  isOrderSelectedAsDeliveryStatsSample,
} from "./delivery-stats-aggregation";
import { buildDeliveryStatsDiagnostics } from "./delivery-stats-diagnostics";

const baseOrder = {
  supplier_id: "s1",
  request_kind: "zamowienie",
  status: "Zrealizowane",
  ordered_at: "2026-05-01T10:00:00Z",
  action_at: "2026-05-01T09:00:00Z",
  order_type: "Glowne",
  products: "Widget",
};

describe("aggregateDeliveryStatsFromOrders", () => {
  it("liczy jedną próbkę na dostawcę i dzień zamówienia", () => {
    const orders = [
      {
        ...baseOrder,
        id: "o1",
        delivery_at: "2026-05-06T12:00:00Z",
      },
      {
        ...baseOrder,
        id: "o2",
        delivery_at: "2026-05-07T12:00:00Z",
        order_type: "Poboczne",
        products: "Widget 2",
      },
    ];

    const { bySupplier, samples, skipped } = aggregateDeliveryStatsFromOrders(orders);
    expect(samples).toHaveLength(1);
    expect(skipped.some((s) => s.reason === "duplikat dnia")).toBe(true);
    expect(bySupplier.get("s1")?.main_count).toBe(1);
  });

  it("pomija informację, brak produktu i częściową realizację", () => {
    const { samples, skipped } = aggregateDeliveryStatsFromOrders([
      {
        ...baseOrder,
        id: "i1",
        request_kind: "informacja",
        delivery_at: "2026-05-06T12:00:00Z",
      },
      {
        ...baseOrder,
        id: "m1",
        products: "brak produktu",
        delivery_at: "2026-05-08T12:00:00Z",
      },
      {
        ...baseOrder,
        id: "p1",
        status: "Czesciowo_zrealizowane",
        delivery_at: "2026-05-09T12:00:00Z",
      },
    ]);
    expect(samples).toHaveLength(0);
    expect(skipped.map((s) => s.reason)).toEqual([
      "informacja",
      "brak produktu",
      "nie w pełni zrealizowane",
    ]);
  });

  it("pomija typ None", () => {
    const { samples, skipped } = aggregateDeliveryStatsFromOrders([
      {
        ...baseOrder,
        id: "n1",
        order_type: "None",
        delivery_at: "2026-05-06T12:00:00Z",
      },
    ]);
    expect(samples).toHaveLength(0);
    expect(skipped[0]?.reason).toBe("brak typu zamówienia");
  });

  it("wybiera wcześniejszą dostawę przy duplikacie dnia", () => {
    const orders = [
      {
        ...baseOrder,
        id: "later",
        delivery_at: "2026-05-08T12:00:00Z",
      },
      {
        ...baseOrder,
        id: "earlier",
        delivery_at: "2026-05-06T12:00:00Z",
      },
    ];
    const { samples } = aggregateDeliveryStatsFromOrders(orders);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.orderId).toBe("earlier");
    expect(isOrderSelectedAsDeliveryStatsSample("earlier", orders)).toBe(true);
    expect(isOrderSelectedAsDeliveryStatsSample("later", orders)).toBe(false);
  });
});

describe("hasSiblingDeliveryStatsSample", () => {
  it("wykrywa istniejące zamówienie z tego samego dnia zamówienia", () => {
    const sibling = {
      ...baseOrder,
      id: "o1",
      delivery_at: "2026-05-06T12:00:00Z",
    };
    const candidate = {
      ...baseOrder,
      id: "o2",
      delivery_at: "2026-05-07T12:00:00Z",
    };
    expect(hasSiblingDeliveryStatsSample(candidate, [sibling])).toBe(true);
    expect(hasSiblingDeliveryStatsSample(sibling, [candidate])).toBe(true);
  });
});

describe("buildDeliveryStatsDiagnostics", () => {
  it("wykrywa brak wiersza delivery_stats mimo próbek", () => {
    const diag = buildDeliveryStatsDiagnostics({
      suppliers: [
        {
          id: "s1",
          name: "ACME",
          stats_mode: "LACZNIE",
          is_active: true,
        },
      ],
      storedStats: [],
      orders: [
        {
          id: "o1",
          supplier_id: "s1",
          request_kind: "zamowienie",
          status: "Zrealizowane",
          ordered_at: "2026-05-01T10:00:00Z",
          action_at: "2026-05-01T09:00:00Z",
          delivery_at: "2026-05-08T12:00:00Z",
          order_type: "Glowne",
          products: "Produkt",
        },
      ],
    });
    expect(diag.suppliers[0]?.health).toBe("missing_row");
    expect(diag.summary.suppliersMismatch).toBe(1);
  });

  it("oznacza niską pewność przy 1–2 próbkach", () => {
    const diag = buildDeliveryStatsDiagnostics({
      suppliers: [
        {
          id: "s1",
          name: "ACME",
          stats_mode: "OSOBNO",
          is_active: true,
        },
      ],
      storedStats: [
        {
          supplier_id: "s1",
          main_sum: 5,
          main_count: 1,
          main_avg: 5,
          side_sum: null,
          side_count: null,
          side_avg: null,
          updated_at: "2026-05-10T00:00:00Z",
        },
      ],
      orders: [
        {
          id: "o1",
          supplier_id: "s1",
          request_kind: "zamowienie",
          status: "Zrealizowane",
          ordered_at: "2026-05-01T10:00:00Z",
          action_at: "2026-05-01T09:00:00Z",
          delivery_at: "2026-05-08T12:00:00Z",
          order_type: "Glowne",
          products: "Produkt",
        },
      ],
    });
    expect(diag.suppliers[0]?.health).toBe("low_samples");
  });
});
