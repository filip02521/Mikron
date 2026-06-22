import type { IndividualOrder } from "@/types/database";
import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import { isInformacjaRequest } from "@/lib/orders/individual";
import {
  RECEIVE_QUEUE_HEADER_ESTIMATE_PX,
  RECEIVE_QUEUE_ORDER_ROW_ESTIMATE_PX,
} from "@/lib/ui/virtual-list-config";

export type ReceiveQueueVirtualItem =
  | {
      kind: "supplier-header";
      key: string;
      groupIndex: number;
      group: SupplierOrderGroup;
    }
  | {
      kind: "order";
      key: string;
      groupIndex: number;
      rowIndex: number;
      order: IndividualOrder;
    };

export function buildReceiveQueueVirtualItems(
  supplierGroups: SupplierOrderGroup[],
  isGroupExpanded: (supplierKey: string) => boolean
): ReceiveQueueVirtualItem[] {
  const items: ReceiveQueueVirtualItem[] = [];

  supplierGroups.forEach((group, groupIndex) => {
    items.push({
      kind: "supplier-header",
      key: `header:${group.supplierKey}`,
      groupIndex,
      group,
    });

    if (!isGroupExpanded(group.supplierKey)) return;

    group.orders.forEach((order, rowIndex) => {
      items.push({
        kind: "order",
        key: `order:${order.id}`,
        groupIndex,
        rowIndex,
        order,
      });
    });
  });

  return items;
}

export function countReceiveQueueOrderRows(items: ReceiveQueueVirtualItem[]): number {
  return items.filter((item) => item.kind === "order").length;
}

function orderProductLabel(order: IndividualOrder): string {
  return (order.products ?? "").trim();
}

/** Szacunek wysokości wiersza — lekko zawyżony, żeby ograniczyć „przeskakiwanie” przed pomiarem. */
export function estimateReceiveQueueVirtualItemSize(item: ReceiveQueueVirtualItem): number {
  if (item.kind === "supplier-header") {
    return RECEIVE_QUEUE_HEADER_ESTIMATE_PX;
  }

  const order = item.order;
  let height = RECEIVE_QUEUE_ORDER_ROW_ESTIMATE_PX;
  const labelLen = orderProductLabel(order).length;

  if (labelLen > 40) height += 16;
  if (labelLen > 80) height += 16;
  if (isInformacjaRequest(order)) height += 6;
  if (order.sales_cancelled_at) height += 4;

  return height;
}
