import { describe, it, expect } from "vitest";
import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";

/**
 * Replika logiki z useReceiveQueueStockAlert — testujemy czystą logikę
 * bez zależności od hooków React.
 */
function collectReceiveQueueTwIds(orders: IndividualOrder[]): number[] {
  const ids = new Set<number>();
  for (const order of orders) {
    if (isInformacjaRequest(order)) continue;
    if (order.is_teeth) continue;
    if (order.status !== "Zamowione") continue;
    const twId = order.subiekt_tw_id;
    if (twId != null && twId > 0) ids.add(Math.trunc(twId));
  }
  return [...ids];
}

function countAvailableOrders(
  orders: IndividualOrder[],
  availableTwIds: Set<number>,
): number {
  let count = 0;
  for (const order of orders) {
    if (isInformacjaRequest(order)) continue;
    if (order.is_teeth) continue;
    if (order.status !== "Zamowione") continue;
    const twId = order.subiekt_tw_id;
    if (twId != null && twId > 0 && availableTwIds.has(Math.trunc(twId))) count++;
  }
  return count;
}

function makeOrder(overrides: Partial<IndividualOrder> = {}): IndividualOrder {
  return {
    id: "test-1",
    supplier_id: "sup-1",
    sales_person_id: "sp-1",
    products: "Test Product",
    symbol: "TEST-001",
    quantity: "5",
    status: "Zamowione",
    action_at: new Date().toISOString(),
    request_kind: "zamowienie",
    is_teeth: false,
    subiekt_tw_id: 100,
    ...overrides,
  } as IndividualOrder;
}

describe("collectReceiveQueueTwIds", () => {
  it("zbiera twIds z zamówień o statusie Zamowione", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 200 }),
    ];
    expect(collectReceiveQueueTwIds(orders).sort()).toEqual([100, 200]);
  });

  it("pomija informacje", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 200, request_kind: "informacja" as const }),
    ];
    expect(collectReceiveQueueTwIds(orders)).toEqual([100]);
  });

  it("pomija zęby", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 200, is_teeth: true }),
    ];
    expect(collectReceiveQueueTwIds(orders)).toEqual([100]);
  });

  it("pominia częściowo zrealizowane", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 200, status: "Czesciowo_zrealizowane" as const }),
    ];
    expect(collectReceiveQueueTwIds(orders)).toEqual([100]);
  });

  it("pomija brak subiekt_tw_id", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: null }),
      makeOrder({ id: "3", subiekt_tw_id: 0 }),
    ];
    expect(collectReceiveQueueTwIds(orders)).toEqual([100]);
  });

  it("deduplikuje te same twIds", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 100 }),
    ];
    expect(collectReceiveQueueTwIds(orders)).toEqual([100]);
  });
});

describe("countAvailableOrders", () => {
  it("liczy zamówienia z dostępnym towarem", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 200 }),
      makeOrder({ id: "3", subiekt_tw_id: 300 }),
    ];
    const availableTwIds = new Set([100, 300]);
    expect(countAvailableOrders(orders, availableTwIds)).toBe(2);
  });

  it("pomija informacje nawet gdy twId jest w availableTwIds", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
      makeOrder({ id: "2", subiekt_tw_id: 200, request_kind: "informacja" as const }),
    ];
    const availableTwIds = new Set([100, 200]);
    expect(countAvailableOrders(orders, availableTwIds)).toBe(1);
  });

  it("zwraca 0 gdy brak dostępnych", () => {
    const orders = [
      makeOrder({ id: "1", subiekt_tw_id: 100 }),
    ];
    expect(countAvailableOrders(orders, new Set())).toBe(0);
  });
});
