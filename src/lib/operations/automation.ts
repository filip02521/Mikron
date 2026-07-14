import { syncSuppliersFromSettings } from "@/lib/services/sync";
import { processMarkedDeliveries } from "@/lib/services/orders";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";
import {
  purgeDataRetention,
  type DataRetentionResult,
} from "@/lib/services/history-cleanup";
import { cleanupStaleTeethOcrImages, type TeethOcrCleanupResult } from "@/lib/services/teeth-ocr-cleanup";
import {
  dataRetentionCutoffDateOnly,
  dataRetentionCutoffIso,
} from "@/lib/data/data-retention";

const MORNING_LOCK = "MORNING_ROUTINE";
const DATA_RETENTION_LOCK_KEY = "history_retention_purge";
const DATA_RETENTION_LOCK_TTL_SEC = 24 * 60 * 60;

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
  historyCleanup: DataRetentionResult;
  historyRetentionSkipped: boolean;
  teethOcrCleanup: TeethOcrCleanupResult;
};

/**
 * Poranna rutyna (cron, opcjonalnie): harmonogramy → kolejka → zapasowe czyszczenie historii.
 * Retencja historii działa też bez crona (przy zapisach w aplikacji, blokada 24 h w bazie).
 */
export async function runMorningRoutine(): Promise<MorningRoutineResult> {
  const sync = await runMorningScheduleSync();
  const deliveries = await processMarkedDeliveries({ lockedBy: "morning-cron" });
  const { cleanup: historyCleanup, skipped: historyRetentionSkipped } =
    await runMorningHistoryCleanup();
  const teethOcrCleanup = await cleanupStaleTeethOcrImages();
  return { sync, deliveries, historyCleanup, historyRetentionSkipped, teethOcrCleanup };
}

async function runMorningHistoryCleanup(): Promise<{
  cleanup: DataRetentionResult;
  skipped: boolean;
}> {
  const acquired = await tryAcquireLock(
    DATA_RETENTION_LOCK_KEY,
    DATA_RETENTION_LOCK_TTL_SEC,
    "morning-cron"
  );
  if (!acquired) {
    return {
      skipped: true,
      cleanup: {
        cutoffIso: dataRetentionCutoffIso(),
        cutoffDateOnly: dataRetentionCutoffDateOnly(),
        individualDeleted: 0,
        normalDeleted: 0,
        warehouseReceiptsDeleted: 0,
        operationsNotesDeleted: 0,
        productEventsDeleted: 0,
        salesBugReportsDeleted: 0,
        departmentBoardThreadsDeleted: 0,
        passwordResetOtpsDeleted: 0,
        subiektZdIndexDeleted: 0,
        authRateLimitEventsDeleted: 0,
      },
    };
  }
  try {
    return { skipped: false, cleanup: await purgeDataRetention() };
  } catch (e) {
    console.error("[morning-cron] history retention purge failed:", e);
    throw e;
  }
}
