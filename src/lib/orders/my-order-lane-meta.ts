import { isAwaitingInformacjaAck, isAwaitingSalesPickup } from "@/lib/orders/sales-pickup";
import { isSalesCancelNoticePending } from "@/lib/orders/sales-cancel";
import type {
  MyOrderAcknowledgeMode,
  MyOrderLine,
} from "@/lib/orders/my-order-presenter";
import type { MyOrderPickupAckMode } from "@/lib/orders/my-order-pickup-ack-copy";
import { myOrderGroupKey } from "@/lib/orders/my-order-groups";
import type { IndividualOrder } from "@/types/database";

export type MyOrderProductLaneKind = "teeth" | "regular" | "mixed" | "none";

export function canAcknowledgePickupForOrder(order: IndividualOrder): boolean {
  return isAwaitingSalesPickup(order) || isAwaitingInformacjaAck(order);
}

/** Tryb potwierdzenia dla pojedynczej linii zamówienia. */
export function resolveLinePickupAckMode(order: IndividualOrder): MyOrderPickupAckMode | "none" {
  if (!canAcknowledgePickupForOrder(order)) return "none";
  if (isAwaitingInformacjaAck(order)) return "availability";
  if (isAwaitingSalesPickup(order) && order.is_teeth) return "teeth_handover";
  if (isAwaitingSalesPickup(order)) return "pickup";
  return "none";
}

export function resolveGroupAcknowledgeMode(orders: IndividualOrder[]): MyOrderAcknowledgeMode {
  const open = orders.filter((o) => !o.sales_acknowledged_at);
  if (!open.length) return "none";
  if (open.every((o) => o.status === "Anulowane")) {
    return "cancelled";
  }
  const pickupPending = open.filter((o) => isAwaitingSalesPickup(o));
  if (pickupPending.length) {
    const teethPickup = pickupPending.filter((o) => o.is_teeth);
    const shelfPickup = pickupPending.filter((o) => !o.is_teeth);
    if (teethPickup.length && shelfPickup.length) return "mixed_pickup";
    if (teethPickup.length === pickupPending.length) return "teeth_handover";
    return "pickup";
  }
  if (open.some((o) => isAwaitingInformacjaAck(o))) return "availability";
  if (open.some((o) => isSalesCancelNoticePending(o))) {
    return "cancel_notice";
  }
  return "none";
}

/** Badge karty — „Zęby + towar” tylko gdy oba tory czekają na potwierdzenie. */
export function displayProductLaneKind(
  laneKind: MyOrderProductLaneKind | undefined,
  acknowledgeMode: MyOrderAcknowledgeMode
): MyOrderProductLaneKind | undefined {
  if (!laneKind || laneKind === "none") return undefined;
  if (laneKind !== "mixed") return laneKind;
  if (acknowledgeMode === "mixed_pickup") return "mixed";
  if (acknowledgeMode === "teeth_handover") return "teeth";
  if (acknowledgeMode === "pickup") return "regular";
  return "mixed";
}

export function classifyMyOrderProductLanes(
  lines: Array<Pick<MyOrderLine, "isTeeth">>
): { hasTeeth: boolean; hasRegular: boolean; laneKind: MyOrderProductLaneKind } {
  const hasTeeth = lines.some((line) => line.isTeeth);
  const hasRegular = lines.some((line) => !line.isTeeth);
  const laneKind: MyOrderProductLaneKind =
    hasTeeth && hasRegular ? "mixed" : hasTeeth ? "teeth" : hasRegular ? "regular" : "none";
  return { hasTeeth, hasRegular, laneKind };
}

export function splitPickupPendingIds(orders: IndividualOrder[]): {
  teethIds: string[];
  shelfIds: string[];
  allIds: string[];
} {
  const pending = orders.filter(canAcknowledgePickupForOrder);
  const teethIds = pending.filter((o) => o.is_teeth && isAwaitingSalesPickup(o)).map((o) => o.id);
  const shelfIds = pending.filter((o) => !o.is_teeth && isAwaitingSalesPickup(o)).map((o) => o.id);
  return { teethIds, shelfIds, allIds: pending.map((o) => o.id) };
}

export const MY_ORDER_SUBMISSION_SPLIT_HINT =
  "Inna część tej samej prośby jest na osobnej karcie (inny status lub tor realizacji).";

/** Liczba kart w /moje dla tego samego submission_group_id. */
export function countSubmissionGroupCards(
  submissionGroupId: string | null | undefined,
  orders: IndividualOrder[],
  options?: { includeAcknowledged?: boolean }
): number {
  if (!submissionGroupId?.trim()) return 0;
  const keys = new Set<string>();
  for (const order of orders) {
    if (order.submission_group_id !== submissionGroupId) continue;
    if (!options?.includeAcknowledged && order.sales_acknowledged_at) continue;
    keys.add(myOrderGroupKey(order));
  }
  return keys.size;
}

export function submissionGroupSplitHint(
  submissionGroupId: string | null | undefined,
  orders: IndividualOrder[]
): string | null {
  const count = countSubmissionGroupCards(submissionGroupId, orders, {
    includeAcknowledged: true,
  });
  return count > 1 ? MY_ORDER_SUBMISSION_SPLIT_HINT : null;
}
