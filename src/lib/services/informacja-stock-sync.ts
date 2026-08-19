import { fetchInformacjaStockAutoEnabled } from "@/lib/data/informacja-stock-auto";
import { fetchInformacjaQueue } from "@/lib/data/queries";
import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";
import { revalidateAfterInformacjaArrived } from "@/lib/orders/informacja-arrived-revalidate";
import {
  chunkInformacjaArrivedIds,
  isInformacjaStockAutoArriveEligible,
  selectInformacjaStockAutoArriveCandidates,
} from "@/lib/orders/informacja-stock-auto-arrive";
import { MAX_QUEUE_BATCH_SIZE } from "@/lib/security/text-limits";
import { markInformacjaArrived } from "@/lib/services/orders";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import { isSubiektConfigured } from "@/lib/subiekt/config";
import { isSubiektReachable } from "@/lib/subiekt/availability";

const INFORMACJA_STOCK_AUTO_LOCK = "informacja-stock-auto-arrive";
const INFORMACJA_STOCK_AUTO_LOCK_TTL_SEC = 300;

/** Soft budget przy wejściu na /kolejka (nie blokuje TTFB na dłużej). */
export const INFORMACJA_STOCK_SYNC_PAGE_BUDGET_MS = 8_000;

export type InformacjaStockSyncResult = {
  ok: boolean;
  skipped?: boolean;
  skipReason?: string;
  candidates: number;
  eligible: number;
  updated: number;
  skippedOrders: number;
  emailSent: number;
  emailError?: string;
  subiektOffline?: boolean;
  timedOut?: boolean;
};

export async function runInformacjaStockAutoArrive(options?: {
  lockedBy?: string;
  /** Soft budget ms — po przekroczeniu kończy bez dalszych batchy. */
  maxDurationMs?: number;
  revalidate?: boolean;
}): Promise<InformacjaStockSyncResult> {
  const empty = (partial: Partial<InformacjaStockSyncResult> = {}): InformacjaStockSyncResult => ({
    ok: true,
    candidates: 0,
    eligible: 0,
    updated: 0,
    skippedOrders: 0,
    emailSent: 0,
    ...partial,
  });

  if (!(await fetchInformacjaStockAutoEnabled())) {
    return empty({ skipped: true, skipReason: "disabled" });
  }

  if (!isSubiektConfigured()) {
    return empty({ skipped: true, skipReason: "subiekt_not_configured" });
  }

  const lockedBy = options?.lockedBy ?? "informacja-stock-auto-arrive";
  const acquired = await tryAcquireLock(
    INFORMACJA_STOCK_AUTO_LOCK,
    INFORMACJA_STOCK_AUTO_LOCK_TTL_SEC,
    lockedBy
  );
  if (!acquired) {
    return empty({ skipped: true, skipReason: "lock_held" });
  }

  const started = Date.now();
  const budget = options?.maxDurationMs;

  try {
    const reachable = await isSubiektReachable();
    if (!reachable) {
      return empty({
        ok: false,
        skipped: true,
        skipReason: "subiekt_offline",
        subiektOffline: true,
      });
    }

    const queue = await fetchInformacjaQueue();
    const pool = queue.filter(isInformacjaStockAutoArriveEligible);
    const candidates = pool.length;
    if (!candidates) {
      return empty({ candidates: 0, eligible: 0 });
    }

    if (budget != null && Date.now() - started >= budget) {
      return empty({ candidates, eligible: 0, timedOut: true, ok: true });
    }

    const twIds = [
      ...new Set(
        pool
          .map((o) => Math.trunc(o.subiekt_tw_id!))
          .filter((id) => id > 0)
      ),
    ];

    const stockByTwId = await fetchProsbaLineStock(twIds);
    const selected = selectInformacjaStockAutoArriveCandidates(pool, stockByTwId);
    const eligible = selected.length;

    if (!eligible) {
      return empty({ candidates, eligible: 0 });
    }

    if (budget != null && Date.now() - started >= budget) {
      return empty({ candidates, eligible, timedOut: true, ok: true });
    }

    /** TOCTOU: świeża mapa stanu tuż przed zapisem (bez reuse przy budżecie fast-path). */
    const recheckTwIds = [...new Set(selected.map((c) => c.subiektTwId))];
    const freshStock = await fetchProsbaLineStock(recheckTwIds);

    const stillOk = selectInformacjaStockAutoArriveCandidates(
      pool.filter((o) => selected.some((c) => c.orderId === o.id)),
      freshStock
    );
    const orderIds = stillOk.map((c) => c.orderId);
    if (!orderIds.length) {
      return empty({ candidates, eligible, skippedOrders: eligible });
    }

    const stillOkByOrderId = new Map(stillOk.map((c) => [c.orderId, c]));
    const chunks = chunkInformacjaArrivedIds(orderIds, MAX_QUEUE_BATCH_SIZE);
    let updated = 0;
    let skippedOrders = eligible - orderIds.length;
    let emailSent = 0;
    let emailError: string | undefined;
    let timedOut = false;

    for (const chunk of chunks) {
      if (budget != null && Date.now() - started >= budget) {
        timedOut = true;
        break;
      }

      const chunkTwIds = [
        ...new Set(
          chunk
            .map((id) => stillOkByOrderId.get(id)?.subiektTwId)
            .filter((twId): twId is number => twId != null && twId > 0)
        ),
      ];
      const chunkStock =
        chunkTwIds.length > 0
          ? await fetchProsbaLineStock(chunkTwIds)
          : freshStock;

      const result = await markInformacjaArrived(chunk, {
        source: "stock_auto",
        stockByTwId: chunkStock,
      });
      updated += result.updated;
      skippedOrders += result.skipped;
      emailSent += result.emailSent;
      if (result.emailError) {
        emailError = emailError
          ? `${emailError}; ${result.emailError}`
          : result.emailError;
      }
    }

    if (updated > 0 && options?.revalidate !== false) {
      revalidateAfterInformacjaArrived();
    }

    return {
      ok: !timedOut || updated > 0,
      candidates,
      eligible,
      updated,
      skippedOrders,
      emailSent,
      emailError,
      timedOut: timedOut || undefined,
    };
  } finally {
    await releaseLock(INFORMACJA_STOCK_AUTO_LOCK);
  }
}
