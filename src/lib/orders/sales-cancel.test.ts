import { describe, expect, it } from "vitest";
import {
  canSalesCancelOrders,
  effectiveSalesCancelPhase,
  isSalesCancelNoticePending,
  isSalesCancelledForQueue,
  resolveSalesCancelPhase,
  resolveGroupSalesCancelPhase,
  salesCancelConfirmCopy,
} from "./sales-cancel";
import type { IndividualOrder } from "@/types/database";

function order(
  status: IndividualOrder["status"],
  extra: Partial<IndividualOrder> = {}
): IndividualOrder {
  return {
    id: "1",
    supplier_id: "s",
    sales_person_id: "sp",
    symbol: "A",
    products: "P",
    quantity: "3",
    delivered_quantity: "-",
    order_type: "Glowne",
    request_kind: "zamowienie",
    status,
    action_at: "2026-05-01",
    ordered_at: null,
    delivery_at: null,
    ...extra,
  };
}

function informacja(
  status: IndividualOrder["status"],
  extra: Partial<IndividualOrder> = {}
): IndividualOrder {
  return order(status, { request_kind: "informacja", quantity: "-", ...extra });
}

describe("sales-cancel", () => {
  it("resolveSalesCancelPhase — fazy przed, w drodze i na stanie", () => {
    expect(resolveSalesCancelPhase(order("Nowe"))).toBe("before_order");
    expect(resolveSalesCancelPhase(order("Weryfikacja"))).toBe("before_order");
    expect(resolveSalesCancelPhase(order("Zamowione"))).toBe("in_transit");
    expect(
      resolveSalesCancelPhase(
        order("Czesciowo_zrealizowane", { delivered_quantity: "0" })
      )
    ).toBe("in_transit");
    expect(
      resolveSalesCancelPhase(
        order("Czesciowo_zrealizowane", { delivered_quantity: "1" })
      )
    ).toBe("on_stock");
    expect(resolveSalesCancelPhase(order("Zrealizowane"))).toBe("on_stock");
    expect(resolveSalesCancelPhase(order("Anulowane"))).toBeNull();
    expect(
      resolveSalesCancelPhase(order("Zamowione", { sales_cancelled_at: "x" }))
    ).toBeNull();
  });

  it("grupa anulowalna gdy wszystkie otwarte i w tej samej fazie logicznej", () => {
    expect(canSalesCancelOrders([order("Nowe"), order("Nowe")])).toBe(true);
    expect(canSalesCancelOrders([order("Nowe"), order("Zamowione")])).toBe(true);
    expect(
      canSalesCancelOrders([
        order("Zamowione", { sales_cancelled_at: "2026-05-01" }),
      ])
    ).toBe(false);
  });

  it("resolveGroupSalesCancelPhase wybiera najostrzejszą fazę", () => {
    expect(
      resolveGroupSalesCancelPhase([order("Nowe"), order("Zrealizowane")])
    ).toBe("on_stock");
  });

  it("isSalesCancelledForQueue tylko in_transit i on_stock", () => {
    expect(
      isSalesCancelledForQueue({
        ...order("Zamowione"),
        sales_cancelled_at: "t",
        sales_cancel_phase: "in_transit",
      })
    ).toBe(true);
    expect(
      isSalesCancelledForQueue({
        ...order("Anulowane"),
        sales_cancelled_at: "t",
        sales_cancel_phase: "before_order",
      })
    ).toBe(false);
  });

  it("isSalesCancelNoticePending dla rezygnacji po zamówieniu", () => {
    expect(
      isSalesCancelNoticePending({
        ...order("Zamowione"),
        sales_cancelled_at: "t",
        sales_cancel_phase: "in_transit",
      })
    ).toBe(true);
    expect(
      isSalesCancelNoticePending({
        ...order("Anulowane"),
        sales_cancelled_at: "t",
        sales_cancel_phase: "before_order",
      })
    ).toBe(false);
  });

  it("salesCancelConfirmCopy ma teksty dla każdej fazy", () => {
    expect(salesCancelConfirmCopy("before_order").confirmLabel).toContain("Wycofaj");
    expect(salesCancelConfirmCopy("in_transit").title).toContain("Rezygnujesz");
    expect(salesCancelConfirmCopy("on_stock").title).toContain("towaru");
  });

  it("effectiveSalesCancelPhase — wywnioskowanie bez kolumny phase", () => {
    expect(
      effectiveSalesCancelPhase({
        ...order("Zamowione"),
        sales_cancelled_at: "2026-05-01T00:00:00Z",
        sales_cancel_phase: null,
      })
    ).toBe("in_transit");
    expect(
      effectiveSalesCancelPhase({
        ...order("Zrealizowane"),
        sales_cancelled_at: "2026-05-01T00:00:00Z",
        sales_cancel_phase: null,
      })
    ).toBe("on_stock");
  });

  it("informacja — wycofanie jako before_order (także gdy dostępna)", () => {
    expect(resolveSalesCancelPhase(informacja("Nowe"))).toBe("before_order");
    expect(resolveSalesCancelPhase(informacja("Zrealizowane"))).toBe("before_order");
    expect(resolveSalesCancelPhase(informacja("Weryfikacja"))).toBe("before_order");
  });

  it("canSalesCancelOrders — pomija już wycofane w grupie", () => {
    expect(
      canSalesCancelOrders([
        order("Zamowione", { sales_cancelled_at: "2026-05-01" }),
        order("Zamowione"),
      ])
    ).toBe(true);
  });
});
