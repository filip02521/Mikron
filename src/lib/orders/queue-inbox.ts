import type { IndividualOrder } from "@/types/database";
import { isInformacjaRequest } from "@/lib/orders/individual";
import { isSalesCancelledForQueue } from "@/lib/orders/sales-cancel";
import { mergeReceiveQueueOrders } from "@/lib/orders/receive-queue";

export type QueueInboxSummary = {
  /** Wszystkie pozycje w kolejce przyjęcia (zamówienia + informacje). */
  activeCount: number;
  zamowienieCount: number;
  informacjaCount: number;
  partialCount: number;
  /** Rezygnacje z decyzją zakupów — w kolejce z etykietą. */
  cancelLabelledCount: number;
};

export function summarizeQueueInbox(
  deliveryOrders: IndividualOrder[],
  informacjaOrders: IndividualOrder[] = []
): QueueInboxSummary {
  const receiveQueue = mergeReceiveQueueOrders(deliveryOrders, informacjaOrders);
  const active = receiveQueue.filter((o) => !o.sales_cancelled_at);
  const cancelLabelled = deliveryOrders.filter(
    (o) => o.sales_cancelled_at && isSalesCancelledForQueue(o)
  );
  return {
    activeCount: active.length,
    zamowienieCount: active.filter((o) => !isInformacjaRequest(o)).length,
    informacjaCount: active.filter(isInformacjaRequest).length,
    partialCount: active.filter(
      (o) => !isInformacjaRequest(o) && o.status === "Czesciowo_zrealizowane"
    ).length,
    cancelLabelledCount: cancelLabelled.length,
  };
}
