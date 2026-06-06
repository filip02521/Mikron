import { describe, expect, it } from "vitest";
import { canShowInForSomeoneLeft } from "@/lib/orders/informacja-via-daily-panel";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import {
  filterIndividualOrdersForSalesMyOrders,
  flagsFromInformacjaFlowPath,
  isInformacjaStockOutHiddenFromSales,
  isInformacjaStockOutReorder,
} from "./informacja-stock-out-reorder";
import type { IndividualOrder } from "@/types/database";

function order(partial: Partial<IndividualOrder>): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "p",
    symbol: "A",
    products: "Produkt",
    quantity: "-",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "informacja",
    status: "Nowe",
    action_at: "2026-01-01",
    delivery_at: null,
    ordered_at: null,
    ...partial,
  } as IndividualOrder;
}

describe("informacja-stock-out-reorder", () => {
  it("flagsFromInformacjaFlowPath", () => {
    expect(flagsFromInformacjaFlowPath("stock_out")).toEqual({
      informacjaQueueViaDailyPanel: false,
      informacjaStockOutReorder: true,
    });
    expect(flagsFromInformacjaFlowPath("via_panel").informacjaStockOutReorder).toBe(
      false
    );
  });

  it("stock out nie trafia do kolejki magazynu", () => {
    expect(
      isInformacjaWarehouseQueueOrder(
        order({
          informacja_stock_out_reorder: true,
          informacja_queue_via_daily_panel: false,
        })
      )
    ).toBe(false);
  });

  it("stock out z kompletnymi danymi może być w Prośbach (panel Dziś)", () => {
    expect(
      canShowInForSomeoneLeft(
        order({
          informacja_stock_out_reorder: true,
          supplier_id: "s",
          symbol: "X",
        })
      )
    ).toBe(true);
  });

  it("isInformacjaStockOutReorder", () => {
    expect(isInformacjaStockOutReorder(order({ informacja_stock_out_reorder: true }))).toBe(
      true
    );
    expect(
      isInformacjaStockOutReorder(
        order({ informacja_stock_out_reorder: false, request_kind: "zamowienie" })
      )
    ).toBe(false);
  });

  it("stock out ukryty przed widokiem handlowca", () => {
    const stockOut = order({ informacja_stock_out_reorder: true });
    const direct = order({ informacja_stock_out_reorder: false });
    expect(isInformacjaStockOutHiddenFromSales(stockOut)).toBe(true);
    expect(isInformacjaStockOutHiddenFromSales(direct)).toBe(false);
    expect(filterIndividualOrdersForSalesMyOrders([stockOut, direct])).toEqual([direct]);
  });
});
