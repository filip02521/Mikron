import { createAdminClient } from "@/lib/supabase/admin";
import { UNDO_WINDOW_MS } from "@/lib/orders/daily-panel-undo";

export type DeliverySnapshot = {
  orderId: string;
  deliveredQuantity: string;
  status: string;
  deliveryAt: string | null;
  warehouseShelf: string | null;
  /** Identyfikator wpisu w kolejce opóźnionych powiadomień e-mail. */
  queueId?: string;
};

export type DeliveryUndoToken = {
  kind: "delivery";
  snapshots: DeliverySnapshot[];
};

export type DeliveryUndoPayload = {
  token: DeliveryUndoToken;
  performedAt: number;
  expiresAt: number;
};

export function buildDeliveryUndoPayload(token: DeliveryUndoToken): DeliveryUndoPayload {
  const performedAt = Date.now();
  return {
    token,
    performedAt,
    expiresAt: performedAt + UNDO_WINDOW_MS,
  };
}

export function isDeliveryUndoExpired(payload: DeliveryUndoPayload, at = Date.now()): boolean {
  return at > payload.expiresAt;
}

export async function captureDeliverySnapshot(orderId: string): Promise<DeliverySnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, delivered_quantity, status, delivery_at, warehouse_shelf")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    orderId: data.id as string,
    deliveredQuantity: (data.delivered_quantity as string) ?? "",
    status: (data.status as string) ?? "",
    deliveryAt: (data.delivery_at as string | null) ?? null,
    warehouseShelf: (data.warehouse_shelf as string | null) ?? null,
  };
}

export async function captureDeliverySnapshots(orderIds: string[]): Promise<DeliverySnapshot[]> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("id, delivered_quantity, status, delivery_at, warehouse_shelf")
    .in("id", unique);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    orderId: row.id as string,
    deliveredQuantity: (row.delivered_quantity as string) ?? "",
    status: (row.status as string) ?? "",
    deliveryAt: (row.delivery_at as string | null) ?? null,
    warehouseShelf: (row.warehouse_shelf as string | null) ?? null,
  }));
}

export async function revertDeliverySnapshot(snapshot: DeliverySnapshot): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    delivered_quantity: snapshot.deliveredQuantity,
    status: snapshot.status,
    delivery_at: snapshot.deliveryAt,
    warehouse_shelf: snapshot.warehouseShelf,
  };
  const { error } = await supabase.from("individual_orders").update(update).eq("id", snapshot.orderId);
  if (error) throw new Error(error.message);
}

export async function revertDeliverySnapshots(snapshots: DeliverySnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    await revertDeliverySnapshot(snapshot);
  }
}
