import { describe, expect, it } from "vitest";
import {
  canSalesCancelOrders,
  canPartialSalesCancel,
  effectiveSalesCancelledQuantity,
  effectiveSalesCancelPhase,
  isSalesCancelNoticePending,
  isSalesCancelledForQueue,
  mergeAutoFulfillCancelDisposition,
  mergeSalesCancelUserAutoAck,
  maxSalesCancelQuantity,
  defaultSalesCancelQuantity,
  planSalesCancelQuantity,
  receiveQueueTargetQuantity,
  resolveSalesCancelPhase,
  resolveGroupSalesCancelPhase,
  salesCancelConfirmCopy,
  salesCancelConfirmForLines,
  salesCancelOverflowLabel,
  salesCancelLineRemainderLabel,
  salesCancelLineRemainderAriaLabel,
  salesCancelLineCustomQtyLabel,
  salesCancelLineShortLabel,
  salesCancelQuickActionLabel,
  salesCancelSoleOverflowFullLabel,
  showSalesCancelSupplierQuickAction,
  shouldShowRemainderSpecificLabel,
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
  it("resolveSalesCancelPhase - fazy przed, w drodze i na stanie", () => {
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

  it("salesCancelLineShortLabel i overflow - faza i rodzaj prośby", () => {
    expect(salesCancelLineShortLabel("zamowienie")).toBe("Anuluj pozycję");
    expect(salesCancelLineShortLabel("informacja")).toBe("Anuluj pozycję");
    expect(salesCancelSoleOverflowFullLabel("zamowienie")).toBe("Anuluj prośbę");
    expect(salesCancelSoleOverflowFullLabel("informacja")).toBe("Anuluj informację");
  });

  it("shouldShowRemainderSpecificLabel - tylko częściowa dostawa i reszta > 1", () => {
    expect(shouldShowRemainderSpecificLabel(3, 2)).toBe(true);
    expect(shouldShowRemainderSpecificLabel(1, 2)).toBe(false);
    expect(shouldShowRemainderSpecificLabel(3, 0)).toBe(false);
  });

  it("salesCancelLineRemainderLabel - rezygnacja z brakujących u dostawcy", () => {
    expect(salesCancelLineRemainderLabel()).toBe("Zrezygnuj z brakujących sztuk");
    expect(salesCancelLineRemainderLabel(3)).toBe("Zrezygnuj z brakujących 3 szt.");
    expect(salesCancelLineRemainderLabel(1)).toBe("Zrezygnuj z brakującej 1 szt.");
  });

  it("salesCancelLineRemainderAriaLabel - liczba sztuk dla czytników", () => {
    expect(salesCancelLineRemainderAriaLabel(4)).toBe(
      "Zrezygnuj z brakujących u dostawcy: 4 sztuki"
    );
    expect(salesCancelLineRemainderAriaLabel(1)).toBe("Zrezygnuj z brakującej sztuki u dostawcy");
  });

  it("salesCancelLineCustomQtyLabel - zmiana ilości", () => {
    expect(salesCancelLineCustomQtyLabel()).toBe("Zmniejsz ilość…");
  });

  it("showSalesCancelSupplierQuickAction - 1 szt. u dostawcy po częściowej dostawie", () => {
    const o = order("Czesciowo_zrealizowane", {
      quantity: "5",
      delivered_quantity: "4",
    });
    expect(defaultSalesCancelQuantity(o)).toBe(1);
    expect(showSalesCancelRemainderAction(o)).toBe(false);
    expect(showSalesCancelSupplierQuickAction(o)).toBe(true);
    expect(salesCancelQuickActionLabel()).toBe("Zrezygnuj z brakującej 1 szt.");
  });

  it("showSalesCancelRemainderAction - reszta > 1 przy częściowej dostawie", () => {
    const o = order("Czesciowo_zrealizowane", {
      quantity: "5",
      delivered_quantity: "2",
    });
    expect(showSalesCancelRemainderAction(o)).toBe(true);
    expect(showSalesCancelSupplierQuickAction(o)).toBe(false);
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

  it("mergeSalesCancelUserAutoAck - ukrywa informację po rezygnacji z modala", () => {
    const before = order("Zamowione", { quantity: "5" });
    const update: Record<string, unknown> = {
      sales_cancelled_at: "2026-06-01T10:00:00Z",
      sales_cancel_phase: "in_transit",
    };
    mergeSalesCancelUserAutoAck(update, before, { hasCancelledAt: true }, "2026-06-01T10:01:00Z");
    expect(update.sales_acknowledged_at).toBe("2026-06-01T10:01:00Z");
  });

  it("mergeSalesCancelUserAutoAck - nie archiwizuje częściowej z resztą u dostawcy", () => {
    const before = order("Zamowione", { quantity: "5" });
    const update: Record<string, unknown> = {
      sales_cancelled_at: "2026-06-01T10:00:00Z",
      sales_cancel_phase: "in_transit",
      sales_cancelled_quantity: "2",
    };
    mergeSalesCancelUserAutoAck(update, before, { hasCancelledAt: true }, "2026-06-01T10:01:00Z");
    expect(update.sales_acknowledged_at).toBeUndefined();
  });

  it("mergeAutoFulfillCancelDisposition - in_transit ustawia disposition + fulfilled_at", () => {
    const update: Record<string, unknown> = {};
    mergeAutoFulfillCancelDisposition(update, "in_transit", "2026-06-01T10:00:00Z");
    expect(update.procurement_cancel_disposition).toBe("to_stock");
    expect(update.procurement_cancel_disposition_at).toBe("2026-06-01T10:00:00Z");
    expect(update.procurement_sales_cancel_ack_at).toBe("2026-06-01T10:00:00Z");
    expect(update.warehouse_cancel_fulfilled_at).toBe("2026-06-01T10:00:00Z");
  });

  it("mergeAutoFulfillCancelDisposition - on_stock ustawia disposition + fulfilled_at", () => {
    const update: Record<string, unknown> = {};
    mergeAutoFulfillCancelDisposition(update, "on_stock", "2026-06-01T10:00:00Z");
    expect(update.procurement_cancel_disposition).toBe("to_stock");
    expect(update.warehouse_cancel_fulfilled_at).toBe("2026-06-01T10:00:00Z");
  });

  it("mergeAutoFulfillCancelDisposition - before_order nie ustawia nic", () => {
    const update: Record<string, unknown> = {};
    mergeAutoFulfillCancelDisposition(update, "before_order", "2026-06-01T10:00:00Z");
    expect(update.procurement_cancel_disposition).toBeUndefined();
    expect(update.warehouse_cancel_fulfilled_at).toBeUndefined();
  });

  it("salesCancelConfirmCopy ma teksty dla każdej fazy", () => {
    expect(salesCancelConfirmCopy("before_order").confirmLabel).toBe("Anuluj prośbę");
    expect(salesCancelConfirmCopy("before_order").message).toContain("możesz to cofnąć");
    expect(salesCancelConfirmCopy("in_transit").title).toContain("Anulować");
    expect(salesCancelConfirmCopy("on_stock").title).toContain("Anulować");
  });

  it("salesCancelConfirmCopy - pojedyncza pozycja z nazwą produktu", () => {
    const copy = salesCancelConfirmCopy("before_order", {
      productName: "Ivoclar Variolink",
    });
    expect(copy.title).toContain("pozycję");
    expect(copy.message).toContain("Ivoclar Variolink");
    expect(copy.confirmLabel).toBe("Anuluj pozycję");
  });

  it("salesCancelConfirmForLines - mieszane fazy w grupie", () => {
    const copy = salesCancelConfirmForLines([
      { product: "Produkt A", phase: "before_order" },
      { product: "Produkt B", phase: "in_transit" },
    ]);
    expect(copy.title).toBe("Anulować wszystkie pozycje?");
    expect(copy.message).toContain("Produkt A");
    expect(copy.message).toContain("na różnych etapach");
  });

  it("salesCancelOverflowLabel rozróżnia jedną i wiele pozycji", () => {
    expect(salesCancelOverflowLabel("zamowienie", 1)).toBe("Anuluj prośbę");
    expect(salesCancelOverflowLabel("zamowienie", 2)).toContain("wszystkie");
    expect(salesCancelOverflowLabel("informacja", 1)).toBe("Anuluj informację");
  });

  it("effectiveSalesCancelPhase - wywnioskowanie bez kolumny phase", () => {
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

  it("informacja - wycofanie jako before_order (także gdy dostępna)", () => {
    expect(resolveSalesCancelPhase(informacja("Nowe"))).toBe("before_order");
    expect(resolveSalesCancelPhase(informacja("Zrealizowane"))).toBe("before_order");
    expect(resolveSalesCancelPhase(informacja("Weryfikacja"))).toBe("before_order");
  });

  it("informacja - planSalesCancelQuantity bez ilości liczbowej", () => {
    const o = informacja("Nowe");
    expect(maxSalesCancelQuantity(o)).toBe(1);
    const plan = planSalesCancelQuantity(o);
    expect(plan.cancelQty).toBe(1);
    expect(plan.storedCancelledQuantity).toBeNull();
    expect(plan.statusAfter).toBe("Anulowane");
    expect(plan.keepLineActiveForSales).toBe(false);
  });

  it("informacja - odrzuca częściowe wycofanie", () => {
    expect(() => planSalesCancelQuantity(informacja("Nowe"), 2)).toThrow(
      /tylko w całości/
    );
  });

  it("canSalesCancelOrders - pomija już wycofane w grupie", () => {
    expect(
      canSalesCancelOrders([
        order("Zamowione", { sales_cancelled_at: "2026-05-01" }),
        order("Zamowione"),
      ])
    ).toBe(true);
  });

  it("canSalesCancelOrders - częściowo wycofana linia nadal anulowalna", () => {
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

  it("planSalesCancelQuantity - 2+3=5 częściowa dostawa", () => {
    const o = order("Czesciowo_zrealizowane", {
      quantity: "5",
      delivered_quantity: "2",
    });
    expect(maxSalesCancelQuantity(o)).toBe(5);
    expect(defaultSalesCancelQuantity(o)).toBe(3);
    expect(showSalesCancelRemainderAction(o)).toBe(true);
    const plan = planSalesCancelQuantity(o, 3);
    expect(plan.cancelQty).toBe(3);
    expect(plan.totalCancelledQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBe("3");
    expect(plan.statusAfter).toBe("Zrealizowane");
    expect(plan.keepLineActiveForSales).toBe(true);
  });

  it("planSalesCancelQuantity - przed zamówieniem zostawia aktywną resztę", () => {
    const o = order("Nowe", { quantity: "5" });
    const plan = planSalesCancelQuantity(o, 2);
    expect(plan.storedCancelledQuantity).toBe("2");
    expect(plan.keepLineActiveForSales).toBe(true);
    expect(plan.statusAfter).toBeUndefined();
  });

  it("salesPartialCancelConfirmCopy - częściowa rezygnacja w drodze", () => {
    const copy = salesPartialCancelConfirmCopy("in_transit", "Ivoclar Variolink", 3, 5, 0);
    expect(copy.title).toBe("Zmniejszyć zamówienie?");
    expect(copy.facts).toEqual([{ label: "Zamówione u dostawcy", value: "5 szt." }]);
    expect(copy.outcome).toContain("Odbierzesz 2 szt. po dostawie.");
    expect(copy.outcome).not.toContain("..");
    expect(copy.confirmLabel).toBe("Wycofaj 3 szt.");
    expect(copy.undoHint).toContain("10 sekund");
  });

  it("salesPartialCancelConfirmCopy - 3 z 5 na magazynie, rezygnacja z brakujących 2", () => {
    // Przypadek ze zgłoszenia: maxQty = aktywna ilość (5), domyślnie brakujące 2.
    const copy = salesPartialCancelConfirmCopy("on_stock", "Katana krążek", 2, 5, 3);
    expect(copy.title).toBe("Zrezygnować z brakujących sztuk?");
    expect(copy.facts).toEqual([
      { label: "Na magazynie, czeka na Ciebie", value: "3 szt." },
      { label: "Brakuje u dostawcy", value: "2 szt." },
    ]);
    expect(copy.outcome).toContain("Odbierzesz 3 szt. z magazynu.");
    expect(copy.outcome).toContain("Nie czekasz już na dostawcę");
    expect(copy.outcome).not.toContain("zostaje w prośbie");
    expect(copy.confirmLabel).toBe("Wycofaj 2 szt.");
  });

  it("salesPartialCancelConfirmCopy - ponad brakujące oddaje też towar z magazynu", () => {
    const one = salesPartialCancelConfirmCopy("on_stock", "X", 1, 5, 3);
    expect(one.outcome).toContain("Na 1 szt. od dostawcy nadal czekasz.");
    const four = salesPartialCancelConfirmCopy("on_stock", "X", 4, 5, 3);
    expect(four.title).toBe("Oddać też towar z magazynu?");
    expect(four.outcome).toContain("Odbierzesz 1 szt. z magazynu.");
    expect(four.outcome).toContain("2 szt. z magazynu wraca na stan");
    const all = salesPartialCancelConfirmCopy("on_stock", "X", 5, 5, 3);
    expect(all.outcome).toContain("Nic nie odbierasz");
    expect(all.confirmLabel).toBe("Wycofaj całą pozycję");
  });

  it("salesPartialCancelConfirmCopy - przed zamówieniem pokazuje, ile zostanie", () => {
    const copy = salesPartialCancelConfirmCopy("before_order", "X", 2, 5, 0);
    expect(copy.outcome).toContain("W prośbie zostanie 3 szt.");
  });

  it("planSalesCancelQuantity - Zamowione 5 szt., rezygnacja z 3, zostają 2 u dostawcy", () => {
    const o = order("Zamowione", { quantity: "5" });
    expect(maxSalesCancelQuantity(o)).toBe(5);
    expect(showSalesCancelRemainderAction(o)).toBe(false);
    const plan = planSalesCancelQuantity(o, 3);
    expect(plan.cancelQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBe("3");
    expect(plan.statusAfter).toBeUndefined();
    expect(plan.keepLineActiveForSales).toBe(true);
  });

  it("planSalesCancelQuantity - pełna rezygnacja przed dostawą zapisuje NULL", () => {
    const o = order("Zamowione");
    const plan = planSalesCancelQuantity(o);
    expect(plan.cancelQty).toBe(3);
    expect(plan.storedCancelledQuantity).toBeNull();
    expect(plan.keepLineActiveForSales).toBe(false);
  });

  it("planSalesCancelQuantity - pełny magazyn (Zrealizowane)", () => {
    const o = order("Zrealizowane", {
      quantity: "4",
      delivered_quantity: "4",
    });
    expect(maxSalesCancelQuantity(o)).toBe(4);
    const plan = planSalesCancelQuantity(o);
    expect(plan.cancelQty).toBe(4);
    expect(plan.storedCancelledQuantity).toBeNull();
    expect(plan.keepLineActiveForSales).toBe(false);
  });

  it("planSalesCancelQuantity - druga rezygnacja na tej samej linii", () => {
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

  it("resolveSalesCancelPhase - częściowa rezygnacja, potem przyjęcie na magazyn", () => {
    const o = order("Zrealizowane", {
      quantity: "6",
      delivered_quantity: "3",
      sales_cancelled_at: "2026-05-01",
      sales_cancelled_quantity: "3",
      sales_cancel_phase: "in_transit",
    });
    expect(resolveSalesCancelPhase(o)).toBe("on_stock");
    expect(maxSalesCancelQuantity(o)).toBe(3);
    expect(canPartialSalesCancel(o)).toBe(true);
  });

  it("isSalesCancelledForQueue - pomija częściową z resztą u dostawcy", () => {
    expect(
      isSalesCancelledForQueue({
        ...order("Zamowione"),
        sales_cancelled_at: "t",
        sales_cancel_phase: "in_transit",
        sales_cancelled_quantity: "2",
      })
    ).toBe(false);
  });

  it("receiveQueueTargetQuantity - aktywne zamówienie po częściowej rezygnacji", () => {
    expect(
      receiveQueueTargetQuantity({
        ...order("Zamowione", { quantity: "5" }),
        sales_cancelled_at: "2026-05-01",
        sales_cancelled_quantity: "3",
      })
    ).toBe(2);
  });

  it("receiveQueueCancelDispositionTotal - pełna ilość rezygnacji, nie reszta", () => {
    const cancelledOrder = {
      ...order("Czesciowo_zrealizowane", {
        quantity: "5",
        delivered_quantity: "3",
      }),
      sales_cancelled_at: "2026-05-01",
      sales_cancel_phase: "in_transit" as const,
      procurement_cancel_disposition: "return",
      sales_cancelled_quantity: "5",
    };
    expect(receiveQueueTargetQuantity(cancelledOrder)).toBe(5);
  });

  it("effectiveSalesCancelledQuantity - jawna ilość z kolumny", () => {
    expect(
      effectiveSalesCancelledQuantity({
        ...order("Zamowione"),
        sales_cancelled_at: "2026-05-01",
        sales_cancelled_quantity: "3",
      })
    ).toBe(3);
  });
});
