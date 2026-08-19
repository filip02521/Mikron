import { describe, expect, it } from "vitest";
import {
  chunkInformacjaArrivedIds,
  isInformacjaStockAutoArriveEligible,
  isInformacjaStockAvailableForAutoArrive,
  selectInformacjaStockAutoArriveCandidates,
} from "./informacja-stock-auto-arrive";
import { isInformacjaWarehouseQueueOrder } from "./informacja-warehouse-queue";
import type { IndividualOrder } from "@/types/database";
import type { ProsbaLineStockSnapshot } from "./prosba-stock-check";

function row(
  partial: Partial<IndividualOrder> & Pick<IndividualOrder, "status">
): IndividualOrder {
  return {
    id: "id-1",
    supplier_id: "s",
    sales_person_id: "p",
    symbol: "SYM",
    products: "Towar",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "informacja",
    informacja_queue_via_daily_panel: false,
    informacja_stock_out_reorder: false,
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    subiekt_tw_id: 100,
    is_teeth: false,
    ...partial,
  } as IndividualOrder;
}

function snap(available: number): ProsbaLineStockSnapshot {
  return {
    onHand: available + 1,
    reserved: 1,
    available,
    source: "subiekt",
  };
}

describe("isInformacjaStockAutoArriveEligible", () => {
  it("direct Nowe + tw_Id → tak", () => {
    expect(isInformacjaStockAutoArriveEligible(row({ status: "Nowe" }))).toBe(true);
  });

  it("ręczny wpis (brak tw_Id) → nie", () => {
    expect(
      isInformacjaStockAutoArriveEligible(row({ status: "Nowe", subiekt_tw_id: null }))
    ).toBe(false);
  });

  it("stock_out → nie", () => {
    expect(
      isInformacjaStockAutoArriveEligible(
        row({ status: "Nowe", informacja_stock_out_reorder: true })
      )
    ).toBe(false);
  });

  it("via_panel przed Główne (flaga=true, Nowe) → nie", () => {
    expect(
      isInformacjaStockAutoArriveEligible(
        row({ status: "Nowe", informacja_queue_via_daily_panel: true })
      )
    ).toBe(false);
  });

  it("via_panel po Główne (flaga=false, Nowe, ordered_at) → tak", () => {
    expect(
      isInformacjaStockAutoArriveEligible(
        row({
          status: "Nowe",
          informacja_queue_via_daily_panel: false,
          ordered_at: "2026-05-10T10:00:00Z",
        })
      )
    ).toBe(true);
  });

  it("via_panel + Zamowione → tak", () => {
    expect(
      isInformacjaStockAutoArriveEligible(
        row({
          status: "Zamowione",
          informacja_queue_via_daily_panel: true,
        })
      )
    ).toBe(true);
  });

  it("is_teeth → nie", () => {
    expect(
      isInformacjaStockAutoArriveEligible(row({ status: "Nowe", is_teeth: true }))
    ).toBe(false);
  });

  it("Weryfikacja → nie (poza kolejką)", () => {
    expect(
      isInformacjaStockAutoArriveEligible(row({ status: "Weryfikacja" }))
    ).toBe(false);
  });

  it("kompozycja z isInformacjaWarehouseQueueOrder — drift", () => {
    const o = row({ status: "Nowe", subiekt_tw_id: 50 });
    expect(isInformacjaWarehouseQueueOrder(o)).toBe(true);
    expect(isInformacjaStockAutoArriveEligible(o)).toBe(true);
    const deferred = row({
      status: "Nowe",
      informacja_queue_via_daily_panel: true,
      subiekt_tw_id: 50,
    });
    expect(isInformacjaWarehouseQueueOrder(deferred)).toBe(false);
    expect(isInformacjaStockAutoArriveEligible(deferred)).toBe(false);
  });
});

describe("isInformacjaStockAvailableForAutoArrive", () => {
  it("available > 0 → tak", () => {
    expect(isInformacjaStockAvailableForAutoArrive(snap(1))).toBe(true);
  });

  it("available === 0 → nie", () => {
    expect(isInformacjaStockAvailableForAutoArrive(snap(0))).toBe(false);
  });

  it("ujemny available → nie", () => {
    expect(isInformacjaStockAvailableForAutoArrive(snap(-2))).toBe(false);
  });

  it("brak snapshota → nie", () => {
    expect(isInformacjaStockAvailableForAutoArrive(undefined)).toBe(false);
    expect(isInformacjaStockAvailableForAutoArrive(null)).toBe(false);
  });
});

describe("selectInformacjaStockAutoArriveCandidates", () => {
  it("wybiera eligible ze stanem > 0", () => {
    const orders = [
      row({ id: "a", status: "Nowe", subiekt_tw_id: 10 }),
      row({ id: "b", status: "Nowe", subiekt_tw_id: 20 }),
      row({ id: "c", status: "Nowe", subiekt_tw_id: null }),
    ];
    const stock = { 10: snap(5), 20: snap(0) };
    expect(selectInformacjaStockAutoArriveCandidates(orders, stock)).toEqual([
      { orderId: "a", subiektTwId: 10 },
    ]);
  });

  it("pair-aware cover (available > 0) → tak", () => {
    const orders = [row({ id: "p", status: "Nowe", subiekt_tw_id: 77 })];
    const stock = {
      77: {
        ...snap(3),
        pairAware: true,
        pairRole: "piece" as const,
        pairUnitsPerPack: 10,
      },
    };
    expect(selectInformacjaStockAutoArriveCandidates(orders, stock)).toEqual([
      { orderId: "p", subiektTwId: 77 },
    ]);
  });

  it("brak wpisu w mapie stanu → nie auto", () => {
    const orders = [row({ id: "a", status: "Nowe", subiekt_tw_id: 10 })];
    expect(selectInformacjaStockAutoArriveCandidates(orders, {})).toEqual([]);
  });
});

describe("chunkInformacjaArrivedIds", () => {
  it("dzieli na chunki i deduplikuje", () => {
    const ids = Array.from({ length: 35 }, (_, i) => `id-${i}`);
    ids.push("id-0");
    const chunks = chunkInformacjaArrivedIds(ids, 30);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(30);
    expect(chunks[1]).toHaveLength(5);
  });
});
