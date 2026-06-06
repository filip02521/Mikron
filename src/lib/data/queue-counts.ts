import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import { isSalesCancelledForQueue } from "@/lib/orders/sales-cancel";
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
      isSalesCancelledForQueue(o) && Boolean(o.procurement_cancel_disposition)
  ).length;
}
