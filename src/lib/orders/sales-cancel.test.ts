import { describe, expect, it } from "vitest";
import {
  canSalesCancelOrders,
  effectiveSalesCancelledQuantity,
  effectiveSalesCancelPhase,
  isSalesCancelNoticePending,
  isSalesCancelledForQueue,
  maxSalesCancelQuantity,
  planSalesCancelQuantity,
  receiveQueueTargetQuantity,
  resolveSalesCancelPhase,
  resolveGroupSalesCancelPhase,
  salesCancelConfirmCopy,
  salesCancelConfirmForLines,
  salesCancelOverflowLabel,
  salesPartialCancelConfirmCopy,
  showSalesCancelRemainderAction,
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

  it("salesCancelConfirmCopy — pojedyncza pozycja z nazwą produktu", () => {
    const copy = salesCancelConfirmCopy("before_order", {
      productName: "Ivoclar Variolink",
    });
    expect(copy.title).toContain("pozycję");
    expect(copy.message).toContain("Ivoclar Variolink");
    expect(copy.confirmLabel).toBe("Wycofaj pozycję");
  });

  it("salesCancelConfirmForLines — mieszane fazy w grupie", () => {
    const copy = salesCancelConfirmForLines([
      { product: "Produkt A", phase: "before_order" },
      { product: "Produkt B", phase: "in_transit" },
    ]);
    expect(copy.title).toContain("wybrane");
    expect(copy.message).toContain("Produkt A");
    expect(copy.message).toContain("etapu");
  });

  it("salesCancelOverflowLabel rozróżnia jedną i wiele pozycji", () => {
    expect(salesCancelOverflowLabel("zamowienie", 1)).toBe("Anuluj prośbę");
    expect(salesCancelOverflowLabel("zamowienie", 2)).toContain("wszystkie");
    expect(salesCancelOverflowLabel("informacja", 1)).toBe("Anuluj informację");
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

  it("canSalesCancelOrders — częściowo wycofana linia nadal anulowalna", () => {
    expect(
      canSalesCancelOrders([
        order("Zamowione", {
          quantity: "5",
          sales_cancelled_at: "2026-05-01",
          sales_cancelled_quantity: "2",
        }),
      ])
    ).toBe(true);
  });

  it("planSalesCancelQuantity — 2+3=5 częściowa dostawa", () => {
    const o = order("Czesciowo_zrealizowane", {
      quantity: "5",
      delivered_quantity: "2",
    });
    expect(maxSalesCancelQuantity(o)).toBe(3);
    expect(showSalesCancelRemainderAction(o)).toBe(true);
    const plan = planSalesCancelQuantity(o, 3);
    expect(plan.cancelQty).toBe(3);
    expect(plan.totalCancelledQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBe("3");
    expect(plan.statusAfter).toBe("Zrealizowane");
    expect(plan.keepLineActiveForSales).toBe(true);
  });

  it("planSalesCancelQuantity — przed zamówieniem zostawia aktywną resztę", () => {
    const o = order("Nowe", { quantity: "5" });
    const plan = planSalesCancelQuantity(o, 2);
    expect(plan.storedCancelledQuantity).toBe("2");
    expect(plan.keepLineActiveForSales).toBe(true);
    expect(plan.statusAfter).toBeUndefined();
  });

  it("salesPartialCancelConfirmCopy — częściowa rezygnacja w drodze", () => {
    const copy = salesPartialCancelConfirmCopy(
      "in_transit",
      "Ivoclar Variolink",
      3,
      5,
      0
    );
    expect(copy.title).toBe("Zmniejszyć ilość w zamówieniu?");
    expect(copy.message).toContain("Rezygnujesz z 3 z 5 szt.");
    expect(copy.message).toContain("Pozostałe 2 szt. będą na Ciebie czekały po dostawie.");
    expect(copy.confirmLabel).toBe("Rezygnuję z 3 szt.");
  });

  it("salesPartialCancelConfirmCopy — jedna sztuka zostaje w zamówieniu", () => {
    const copy = salesPartialCancelConfirmCopy(
      "in_transit",
      "Produkt X",
      4,
      5,
      0
    );
    expect(copy.message).toContain(
      "Pozostała 1 szt. będzie na Ciebie czekała po dostawie."
    );
  });

  it("planSalesCancelQuantity — Zamowione 5 szt., rezygnacja z 3, zostają 2 u dostawcy", () => {
    const o = order("Zamowione", { quantity: "5" });
    expect(maxSalesCancelQuantity(o)).toBe(5);
    expect(showSalesCancelRemainderAction(o)).toBe(false);
    const plan = planSalesCancelQuantity(o, 3);
    expect(plan.cancelQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBe("3");
    expect(plan.statusAfter).toBeUndefined();
    expect(plan.keepLineActiveForSales).toBe(true);
  });

  it("planSalesCancelQuantity — pełna rezygnacja przed dostawą zapisuje NULL", () => {
    const o = order("Zamowione");
    const plan = planSalesCancelQuantity(o);
    expect(plan.cancelQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBeNull();
    expect(plan.keepLineActiveForSales).toBe(false);
  });

  it("planSalesCancelQuantity — druga rezygnacja na tej samej linii", () => {
    const o = order("Zamowione", {
      quantity: "5",
      sales_cancelled_at: "2026-05-01",
      sales_cancelled_quantity: "2",
    });
    expect(maxSalesCancelQuantity(o)).toBe(3);
    expect(resolveSalesCancelPhase(o)).toBe("in_transit");
    const plan = planSalesCancelQuantity(o, 1);
    expect(plan.totalCancelledQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBe("3");
  });

  it("isSalesCancelledForQueue — pomija częściową z resztą u dostawcy", () => {
    expect(
      isSalesCancelledForQueue({
        ...order("Zamowione"),
        sales_cancelled_at: "t",
        sales_cancel_phase: "in_transit",
        sales_cancelled_quantity: "2",
      })
    ).toBe(false);
  });

  it("receiveQueueTargetQuantity — aktywne zamówienie po częściowej rezygnacji", () => {
    expect(
      receiveQueueTargetQuantity({
        ...order("Zamowione", { quantity: "5" }),
        sales_cancelled_at: "2026-05-01",
        sales_cancelled_quantity: "3",
      })
    ).toBe(2);
  });

  it("effectiveSalesCancelledQuantity — jawna ilość z kolumny", () => {
    expect(
      effectiveSalesCancelledQuantity({
        ...order("Zamowione"),
        sales_cancelled_at: "2026-05-01",
        sales_cancelled_quantity: "3",
      })
    ).toBe(3);
  });
});
