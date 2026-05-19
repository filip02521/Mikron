import {
  getDeliveryProgress,
  isInformacjaRequest,
  type DeliveryProgress,
} from "@/lib/orders/individual";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";

export type SalesCancelPhase = "before_order" | "in_transit" | "on_stock";

/** Faza zapisana w DB lub wywnioskowana ze statusu (stare rekordy bez sales_cancel_phase). */
export function effectiveSalesCancelPhase(
  order: IndividualOrder
): SalesCancelPhase | null {
  if (!order.sales_cancelled_at) return null;

  const stored = order.sales_cancel_phase as SalesCancelPhase | null | undefined;
  if (
    stored === "before_order" ||
    stored === "in_transit" ||
    stored === "on_stock"
  ) {
    return stored;
  }

  if (order.status === "Anulowane") return "before_order";
  if (order.status === "Zrealizowane") return "on_stock";
  if (order.status === "Czesciowo_zrealizowane") {
    return deliveryProgressFor(order).delivered > 0 ? "on_stock" : "in_transit";
  }
  if (order.status === "Zamowione") return "in_transit";
  return "before_order";
}

export function deliveredQtyRaw(order: IndividualOrder): string {
  return order.delivered_quantity && order.delivered_quantity !== "-"
    ? order.delivered_quantity
    : "0";
}

export function deliveryProgressFor(order: IndividualOrder): DeliveryProgress {
  return getDeliveryProgress(order.quantity, deliveredQtyRaw(order));
}

/** Czy handlowiec może wycofać prośbę w tym statusie. */
export function resolveSalesCancelPhase(
  order: IndividualOrder
): SalesCancelPhase | null {
  if (order.sales_cancelled_at) return null;

  const { status } = order;
  if (status === "Anulowane") return null;

  /** Prośba informacyjna — zawsze proste wycofanie (bez kolejki realizacji). */
  if (isInformacjaRequest(order)) {
    if (status === "Nowe" || status === "Weryfikacja" || status === "Zrealizowane") {
      return "before_order";
    }
    return null;
  }

  if (status === "Nowe" || status === "Weryfikacja") {
    return "before_order";
  }

  if (status === "Zamowione") {
    return "in_transit";
  }

  if (status === "Czesciowo_zrealizowane") {
    const progress = deliveryProgressFor(order);
    if (progress.delivered > 0) return "on_stock";
    return "in_transit";
  }

  if (status === "Zrealizowane") {
    return "on_stock";
  }

  return null;
}

export function canSalesCancelOrders(orders: IndividualOrder[]): boolean {
  const open = orders.filter(
    (o) => !o.sales_acknowledged_at && !o.sales_cancelled_at
  );
  if (!open.length) return false;
  return open.every((o) => resolveSalesCancelPhase(o) !== null);
}

export function isSalesCancelNoticePending(order: IndividualOrder): boolean {
  if (!order.sales_cancelled_at || order.sales_acknowledged_at) return false;
  const phase = effectiveSalesCancelPhase(order);
  return phase === "in_transit" || phase === "on_stock";
}

/** Najostrzejsza faza w grupie (do komunikatu potwierdzenia). */
export function resolveGroupSalesCancelPhase(
  orders: IndividualOrder[]
): SalesCancelPhase | null {
  const phases = orders
    .map(resolveSalesCancelPhase)
    .filter((p): p is SalesCancelPhase => p !== null);
  if (!phases.length) return null;
  if (phases.includes("on_stock")) return "on_stock";
  if (phases.includes("in_transit")) return "in_transit";
  return "before_order";
}

export function salesCancelConfirmCopy(phase: SalesCancelPhase): {
  title: string;
  message: string;
  confirmLabel: string;
} {
  switch (phase) {
    case "before_order":
      return {
        title: "Wycofać prośbę?",
        message:
          "Prośba zniknie z Twojej listy i u działu dostaw. Tej operacji nie cofniesz samodzielnie.",
        confirmLabel: "Wycofaj prośbę",
      };
    case "in_transit":
      return {
        title: "Rezygnujesz z zamówienia?",
        message:
          "Zamówienie może być już u dostawcy. Jeśli towar dotrze, magazyn rozliczy go poza Twoją rezerwacją.",
        confirmLabel: "Rezygnuję",
      };
    case "on_stock":
      return {
        title: "Rezygnujesz z towaru?",
        message:
          "Część lub całość może być już na magazynie. Magazyn rozliczy towar poza Twoją rezerwacją.",
        confirmLabel: "Rezygnuję",
      };
  }
}

export function isSalesCancelledForQueue(order: IndividualOrder): boolean {
  const phase = effectiveSalesCancelPhase(order);
  return phase === "in_transit" || phase === "on_stock";
}

/** Toast po wycofaniu prośby przez handlowca. */
export function salesCancelSuccessToast(): string {
  return "Prośba wycofana. Szczegóły znajdziesz w sekcji „Ostatnio zakończone” poniżej.";
}

/** Opis w archiwum dla wycofanych pozycji (wg fazy rezygnacji). */
export function salesCancelArchiveDetail(
  phase: SalesCancelPhase,
  activityLabel: string | null
): { statusTitle: string; statusDetail: string } {
  const when = activityLabel ? `Wycofano ${activityLabel}.` : "Wycofano.";

  switch (phase) {
    case "in_transit":
      return {
        statusTitle: "Rezygnacja — towar w drodze",
        statusDetail: `${when} Jeśli towar dotrze, magazyn rozliczy go w zakładce Magazyn i regał.`,
      };
    case "on_stock":
      return {
        statusTitle: "Rezygnacja — towar na magazynie",
        statusDetail: `${when} Magazyn rozliczy towar w zakładce Magazyn i regał (stan lub zwrot).`,
      };
    default:
      return {
        statusTitle: "Anulowane",
        statusDetail: activityLabel ? `Wycofano ${activityLabel}` : "Prośba wycofana",
      };
  }
}

export function salesCancelQueueBanner(order: IndividualOrder): string {
  const person = order.sales_person?.name ?? "handlowiec";
  const disposition = order.procurement_cancel_disposition;
  const note = order.procurement_cancel_disposition_note?.trim();

  if (disposition === "to_stock") {
    return note
      ? `Rozliczono: na stan magazynu (${person}) — ${note}`
      : `Rozliczono: na stan magazynu (${person}), poza rezerwacją handlowca.`;
  }
  if (disposition === "return") {
    return note
      ? `Rozliczono: zwrot do dostawcy (${person}) — ${note}`
      : `Rozliczono: przygotować zwrot do dostawcy (${person}).`;
  }

  const phase =
    effectiveSalesCancelPhase(order) ??
    resolveSalesCancelPhase(order) ??
    "in_transit";

  if (phase === "on_stock") {
    return `Rezygnacja ${person} — wybierz: na stan magazynu lub zwrot do dostawcy.`;
  }
  return `Rezygnacja ${person} — towar może jeszcze przyjechać. Po dostawie rozlicz na stan lub zwrot.`;
}
