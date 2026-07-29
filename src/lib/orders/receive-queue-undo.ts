import { createAdminClient } from "@/lib/supabase/admin";
import { parseTeethLineDelivered } from "@/lib/teeth/teeth-receive-picker";
import type { IndividualOrder } from "@/types/database";
import {
  attachDeliveryNotificationQueueIds,
  buildDeliveryUndoPayload,
  collectDeliveryNotificationQueueIds,
  isDeliveryUndoExpired,
  type DeliverySnapshot,
  type DeliveryUndoPayload,
  type DeliveryUndoToken,
} from "@/lib/orders/receive-queue-undo-shared";

export {
  attachDeliveryNotificationQueueIds,
  buildDeliveryUndoPayload,
  collectDeliveryNotificationQueueIds,
  isDeliveryUndoExpired,
  type DeliverySnapshot,
  type DeliveryUndoPayload,
  type DeliveryUndoToken,
};

export async function captureDeliverySnapshot(orderId: string): Promise<DeliverySnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, delivered_quantity, status, delivery_at, warehouse_shelf, teeth_line_delivered")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    orderId: data.id as string,
    deliveredQuantity: (data.delivered_quantity as string) ?? "",
    status: (data.status as string) ?? "",
    deliveryAt: (data.delivery_at as string | null) ?? null,
    warehouseShelf: (data.warehouse_shelf as string | null) ?? null,
    teethLineDelivered: parseTeethLineDelivered(data.teeth_line_delivered),
  };
}

export async function captureDeliverySnapshots(orderIds: string[]): Promise<DeliverySnapshot[]> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, delivered_quantity, status, delivery_at, warehouse_shelf, teeth_line_delivered")
    .in("id", unique);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    orderId: row.id as string,
    deliveredQuantity: (row.delivered_quantity as string) ?? "",
    status: (row.status as string) ?? "",
    deliveryAt: (row.delivery_at as string | null) ?? null,
    warehouseShelf: (row.warehouse_shelf as string | null) ?? null,
    teethLineDelivered: parseTeethLineDelivered(row.teeth_line_delivered),
  }));
}

export async function revertDeliverySnapshot(snapshot: DeliverySnapshot): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    delivered_quantity: snapshot.deliveredQuantity,
    status: snapshot.status,
    delivery_at: snapshot.deliveryAt,
    warehouse_shelf: snapshot.warehouseShelf,
    teeth_line_delivered: snapshot.teethLineDelivered ?? null,
  };
  const { error } = await supabase.from("individual_orders").update(update).eq("id", snapshot.orderId);
  if (error) throw new Error(error.message);
}

export async function revertDeliverySnapshots(snapshots: DeliverySnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    await revertDeliverySnapshot(snapshot);
  }
}

const ZK_SYNC_ORDER_SELECT =
  "id, sales_person_id, status, sales_acknowledged_at, delivered_quantity, source_zk_watch_id, source_zk_number";

/** Po cofnięciu przyjęcia — zsynchronizuj line_checks w powiązanych ZK. */
export async function syncZkWatchAfterDeliveryRevert(orderIds: string[]): Promise<void> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (!unique.length) return;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select(ZK_SYNC_ORDER_SELECT)
    .in("id", unique);

  if (error || !data?.length) return;

  try {
    const { syncZkWatchLineChecksFromOrder } = await import(
      "@/lib/sales/zk-watch-order-sync"
    );
    await Promise.all(
      (data as IndividualOrder[]).map((row) => syncZkWatchLineChecksFromOrder(row))
    );
  } catch (e) {
    console.error("[syncZkWatchAfterDeliveryRevert]", e);
  }
}
