import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import {
  hasActiveSupplierFulfillment,
  isSalesCancelledForQueue,
} from "@/lib/orders/sales-cancel";
import type { IndividualOrder } from "@/types/database";

export type InformacjaQueueCountRow = Pick<
  IndividualOrder,
  "request_kind" | "status" | "informacja_queue_via_daily_panel" | "sales_cancelled_at"
>;

export type DeliveryQueueCancelledCountRow = Pick<
  IndividualOrder,
  | "status"
  | "sales_cancelled_at"
  | "sales_cancel_phase"
  | "quantity"
  | "delivered_quantity"
  | "sales_cancelled_quantity"
  | "procurement_cancel_disposition"
  | "request_kind"
>;

/** Ta sama logika co fetchInformacjaQueue + filter (bez sortowania). */
export function countInformacjaWarehouseQueueRows(
  rows: InformacjaQueueCountRow[]
): number {
  return rows.filter((row) =>
    isInformacjaWarehouseQueueOrder(row as IndividualOrder)
  ).length;
}

/** Rezygnacje z decyzją zakupów widoczne w kolejce dostaw. */
export function countDeliveryQueueCancelledRows(
  rows: DeliveryQueueCancelledCountRow[]
): number {
  return normalizeIndividualOrders(rows as IndividualOrder[]).filter(
    (o) =>
      !o.warehouse_cancel_fulfilled_at &&
      isSalesCancelledForQueue(o) &&
      Boolean(o.procurement_cancel_disposition)
  ).length;
}

/** Pozycje częściowo wycofane, ale z resztą u dostawcy — nadal w kolejce dostaw. */
export function countDeliveryQueueActivePartialRows(
  rows: DeliveryQueueCancelledCountRow[]
): number {
  return normalizeIndividualOrders(rows as IndividualOrder[]).filter(
    (o) =>
      o.request_kind === "zamowienie" &&
      (o.status === "Zamowione" || o.status === "Czesciowo_zrealizowane") &&
      Boolean(o.sales_cancelled_at) &&
      hasActiveSupplierFulfillment(o)
  ).length;
}
