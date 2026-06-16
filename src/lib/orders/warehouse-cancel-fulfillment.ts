import {
  deliveryProgressFor,
  effectiveSalesCancelledQuantity,
  effectiveSalesCancelPhase,
  isSalesCancelledForQueue,
} from "@/lib/orders/sales-cancel";
import type { IndividualOrder } from "@/types/database";

/** Rezygnacja z decyzją zakupów — czeka na rozliczenie przez magazyn. */
export function isCancelledDispositionInReceiveQueue(order: IndividualOrder): boolean {
  return Boolean(
    order.sales_cancelled_at &&
      order.procurement_cancel_disposition &&
      isSalesCancelledForQueue(order) &&
      !order.warehouse_cancel_fulfilled_at
  );
}

export function warehouseCancelFulfillButtonLabel(order: IndividualOrder): string {
  const disposition = order.procurement_cancel_disposition;
  const phase = effectiveSalesCancelPhase(order);
  if (disposition === "to_stock") {
    return phase === "on_stock" ? "Na stan magazynu" : "Przyjęto na stan";
  }
  if (disposition === "return") {
    return phase === "on_stock" ? "Zdjęto z regału" : "Przygotowano do zwrotu";
  }
  return "Rozliczono";
}

/** Towar w drodze — magazyn musi najpierw przyjąć ilość z rezygnacji. */
export function needsReceiveBeforeWarehouseCancelAck(order: IndividualOrder): boolean {
  if (!isCancelledDispositionInReceiveQueue(order)) return false;
  if (effectiveSalesCancelPhase(order) !== "in_transit") return false;
  const cancelled = effectiveSalesCancelledQuantity(order);
  if (cancelled <= 0) return false;
  return deliveryProgressFor(order).delivered < cancelled;
}

export function canAcknowledgeWarehouseCancelDisposition(order: IndividualOrder): boolean {
  return isCancelledDispositionInReceiveQueue(order) && !needsReceiveBeforeWarehouseCancelAck(order);
}

export function warehouseCancelFulfillToast(order: IndividualOrder): string {
  const product = order.products?.trim() || "pozycja";
  const label = warehouseCancelFulfillButtonLabel(order);
  return `${label} · ${product}`;
}
