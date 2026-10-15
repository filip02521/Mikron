import { zdFulfillmentDeadlineChangeShortLabel } from "@/lib/orders/zd-fulfillment-deadline-change";
import type { PendingZdDeadlineChange } from "@/lib/orders/zd-deadline-change-pending";

export type { PendingZdDeadlineChange };

export function buildZdDeadlineChangeToastMessage(items: PendingZdDeadlineChange[]): string {
  if (items.length === 1) {
    const item = items[0]!;
    return `${item.supplierName} · ${zdFulfillmentDeadlineChangeShortLabel(item.change)}`;
  }

  return `Zaktualizowano terminy dla ${items.length} zamówień`;
}

export function zdDeadlineChangeToastTone(
  items: PendingZdDeadlineChange[]
): "success" | "warning" {
  if (items.some((item) => item.change.variant === "postponed")) return "warning";
  return "success";
}
