import type { IndividualOrder } from "@/types/database";
import { isSalesCancelledForQueue } from "@/lib/orders/sales-cancel";

export type QueueInboxSummary = {
  /** Zamówione u dostawcy, czeka na wpis przyjęcia towaru (może jeszcze nie dotrzeć). */
  activeCount: number;
  partialCount: number;
  /** Rezygnacje z decyzją zakupów — w kolejce z etykietą. */
  cancelLabelledCount: number;
};

export function summarizeQueueInbox(orders: IndividualOrder[]): QueueInboxSummary {
  const active = orders.filter((o) => !o.sales_cancelled_at);
  const cancelLabelled = orders.filter(
    (o) => o.sales_cancelled_at && isSalesCancelledForQueue(o)
  );
  return {
    activeCount: active.length,
    partialCount: active.filter((o) => o.status === "Czesciowo_zrealizowane").length,
    cancelLabelledCount: cancelLabelled.length,
  };
}
