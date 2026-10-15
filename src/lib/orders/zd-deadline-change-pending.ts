import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { ZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";

export type PendingZdDeadlineChange = {
  orderIds: string[];
  supplierName: string;
  change: ZdFulfillmentDeadlineChangeDisplay;
};

export function collectPendingZdDeadlineChanges(rows: MyOrderRow[]): PendingZdDeadlineChange[] {
  const pending: PendingZdDeadlineChange[] = [];

  for (const row of rows) {
    const lineChanges = row.lines.filter((line) => line.zdFulfillment?.deadlineChange);
    const change: ZdFulfillmentDeadlineChangeDisplay | null | undefined =
      row.zdFulfillment?.deadlineChange ?? lineChanges[0]?.zdFulfillment?.deadlineChange;
    if (!change) continue;

    const orderIds = lineChanges.length
      ? lineChanges.map((line) => line.id)
      : row.orderIds;
    if (!orderIds.length) continue;

    pending.push({
      orderIds,
      supplierName: row.supplierName,
      change,
    });
  }

  return pending;
}

/**
 * Przesunięcie / przyspieszenie terminu zmienia to, co handlowiec obiecał klientowi — wymaga kliknięcia.
 * Pierwsze ustalenie terminu (z placeholdera dnia zamówienia) dotyczy każdej prośby — potwierdza się samo.
 */
export function zdDeadlineChangeNeedsClick(change: ZdFulfillmentDeadlineChangeDisplay): boolean {
  return change.variant !== "first_confirmed";
}
