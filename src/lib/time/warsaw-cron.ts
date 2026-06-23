import { readCronRun, recordCronRun } from "@/lib/services/cron-run-log";
import { warsawNowParts } from "@/lib/time/warsaw";

/** Czy poranna rutyna już zakończyła się dziś (kalendarz warszawski). */
export async function morningRoutineAlreadyRanToday(): Promise<boolean> {
  const { dateKey } = warsawNowParts();
  const last = await readCronRun("morning_routine");
  if (!last) return false;
  const detail = last.detail as { warsawDateKey?: string; skipped?: boolean } | undefined;
  if (detail?.skipped) return false;
  return detail?.warsawDateKey === dateKey;
}

export async function recordCronSkipped(
  job:
    | "morning_routine"
    | "process_deliveries"
    | "morning_sync"
    | "catalog_zd_sync"
    | "zd_eta_sync",
  reason: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const warsaw = warsawNowParts();
  await recordCronRun(job, {
    ok: true,
    detail: {
      skipped: true,
      reason,
      warsawHour: warsaw.hour,
      warsawDateKey: warsaw.dateKey,
      warsawWeekday: warsaw.weekday,
      ...detail,
    },
  });
}

export function warsawCronContext() {
  const p = warsawNowParts();
  return {
    hour: p.hour,
    dateKey: p.dateKey,
    weekday: p.weekday,
    isWeekend: p.isWeekend,
  };
}
