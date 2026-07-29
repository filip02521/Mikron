/** Typy i helpery cofania przyjęcia — bezpieczne dla klienta (bez Supabase). */

import { UNDO_WINDOW_MS } from "@/lib/orders/daily-panel-undo";

export type DeliverySnapshot = {
  orderId: string;
  deliveredQuantity: string;
  status: string;
  deliveryAt: string | null;
  warehouseShelf: string | null;
  teethLineDelivered?: Record<string, number> | null;
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

export function attachDeliveryNotificationQueueIds(
  snapshots: DeliverySnapshot[],
  queueIdByOrderId: Record<string, string>
): DeliverySnapshot[] {
  if (!Object.keys(queueIdByOrderId).length) return snapshots;
  return snapshots.map((snapshot) => ({
    ...snapshot,
    queueId: queueIdByOrderId[snapshot.orderId] ?? snapshot.queueId,
  }));
}

export function collectDeliveryNotificationQueueIds(
  snapshots: DeliverySnapshot[]
): string[] {
  return [
    ...new Set(
      snapshots.map((snapshot) => snapshot.queueId).filter((id): id is string => Boolean(id))
    ),
  ];
}
