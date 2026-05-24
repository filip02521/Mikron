import { syncSuppliersFromSettings } from "@/lib/services/sync";
import { processMarkedDeliveries } from "@/lib/services/orders";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import { purgeHistoryRetention } from "@/lib/services/history-cleanup";
import type { HistoryCleanupResult } from "@/lib/services/history-cleanup";

const MORNING_LOCK = "MORNING_ROUTINE";

export type MorningSyncResult = {
  schedulesProcessed: number;
  scheduleErrors: string[];
};

/** Przelicza terminy dostawców (urlopy, interwały) — to odświeża panel dzienny i harmonogramy. */
export async function runMorningScheduleSync(): Promise<MorningSyncResult> {
  const acquired = await tryAcquireLock(MORNING_LOCK, 120, "cron-morning-sync");
  if (!acquired) {
    return { schedulesProcessed: 0, scheduleErrors: ["Inna operacja synchronizacji już trwa"] };
  }
  try {
    const result = await syncSuppliersFromSettings();
    return {
      schedulesProcessed: result.processed,
      scheduleErrors: result.errors,
    };
  } finally {
    await releaseLock(MORNING_LOCK);
  }
}

export type MorningRoutineResult = {
  sync: MorningSyncResult;
  deliveries: Awaited<ReturnType<typeof processMarkedDeliveries>>;
  historyCleanup: HistoryCleanupResult;
};

/**
 * Poranna rutyna (cron, opcjonalnie): harmonogramy → kolejka → zapasowe czyszczenie historii.
 * Retencja historii działa też bez crona (przy zapisach w aplikacji, blokada 24 h w bazie).
 */
export async function runMorningRoutine(): Promise<MorningRoutineResult> {
  const sync = await runMorningScheduleSync();
  const deliveries = await processMarkedDeliveries();
  const historyCleanup = await purgeHistoryRetention();
  return { sync, deliveries, historyCleanup };
}
