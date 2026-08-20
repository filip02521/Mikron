import type { IndividualOrder } from "@/types/database";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import { isSubiektVerifiedOrder } from "@/lib/orders/product-source";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";

export type InformacjaArrivedSource = "manual" | "stock_auto";

export type InformacjaStockAutoArriveCandidate = {
  orderId: string;
  subiektTwId: number;
};

/**
 * Pozycja informacyjna kwalifikująca się do automatyki stanu Subiekta:
 * w kolejce magazynu, powiązana z kartoteką (tw_Id > 0), nie zębowa.
 */
export function isInformacjaStockAutoArriveEligible(
  order: Pick<
    IndividualOrder,
    | "request_kind"
    | "status"
    | "informacja_queue_via_daily_panel"
    | "informacja_stock_out_reorder"
    | "sales_cancelled_at"
    | "subiekt_tw_id"
    | "is_teeth"
  >
): boolean {
  if (!isInformacjaWarehouseQueueOrder(order)) return false;
  if (!isSubiektVerifiedOrder(order)) return false;
  if (order.is_teeth) return false;
  return true;
}

/** Czy snapshot stanu pozwala na auto-domknięcie (available > 0). */
export function isInformacjaStockAvailableForAutoArrive(
  snap: ProsbaLineStockSnapshot | null | undefined
): boolean {
  return snap != null && Number.isFinite(snap.available) && snap.available > 0;
}

/**
 * Kandydaci do auto-mark: eligible + stan Subiekta available > 0.
 * Brak wpisu w mapie stanu = nie auto (fail-safe przy partial timeout / offline).
 */
export function selectInformacjaStockAutoArriveCandidates(
  orders: IndividualOrder[],
  stockByTwId: Record<number, ProsbaLineStockSnapshot>
): InformacjaStockAutoArriveCandidate[] {
  const out: InformacjaStockAutoArriveCandidate[] = [];
  for (const order of orders) {
    if (!isInformacjaStockAutoArriveEligible(order)) continue;
    const twId = Math.trunc(order.subiekt_tw_id!);
    const snap = stockByTwId[twId];
    if (!isInformacjaStockAvailableForAutoArrive(snap)) continue;
    out.push({ orderId: order.id, subiektTwId: twId });
  }
  return out;
}

/** Chunkowanie ID do limitu markInformacjaArrived. */
export function chunkInformacjaArrivedIds(
  ids: string[],
  chunkSize: number
): string[][] {
  const size = Math.max(1, Math.trunc(chunkSize));
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}
