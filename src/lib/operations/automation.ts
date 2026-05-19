import { syncSuppliersFromSettings } from "@/lib/services/sync";
import { processMarkedDeliveries } from "@/lib/services/orders";
import { sendDailyStatusToSales } from "@/lib/services/email";
import { tryAcquireLock, releaseLock } from "@/lib/services/locks";

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
  dailySales: Awaited<ReturnType<typeof sendDailyStatusToSales>>;
};

/**
 * Poranna rutyna (cron): harmonogramy → domknięcie kolejki dostaw → e-mail statusu handlowcom.
 * Panel dzienny po wejściu zakupów pokazuje świeże daty bez ręcznego „Przelicz terminy”.
 */
export async function runMorningRoutine(): Promise<MorningRoutineResult> {
  const sync = await runMorningScheduleSync();
  const deliveries = await processMarkedDeliveries();
  const dailySales = await sendDailyStatusToSales();
  return { sync, deliveries, dailySales };
}
