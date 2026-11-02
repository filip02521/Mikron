import {
  computeDailyUrgentProgress,
  type DailyUrgentProgress,
} from "@/lib/orders/daily-urgent-progress";

export type DailyDayProgressSegment = DailyUrgentProgress & {
  label: string;
};

export type DailyDayProgress = {
  urgent: DailyUrgentProgress;
  forSomeone: DailyUrgentProgress;
  combined: DailyUrgentProgress;
  /** Zamówienia automatu ZD na dziś (sprawdzone → wysłane albo odrzucone); brak = automat nic dziś nie przygotował. */
  automat?: DailyUrgentProgress;
  hasWork: boolean;
  complete: boolean;
};

export function combineDayProgress(
  urgent: DailyUrgentProgress,
  forSomeone: DailyUrgentProgress
): DailyUrgentProgress {
  const total = urgent.total + forSomeone.total;
  if (total <= 0) {
    return {
      total: 0,
      done: 0,
      remaining: 0,
      percent: 0,
      complete: false,
      hasWork: false,
    };
  }
  const done = urgent.done + forSomeone.done;
  const remaining = urgent.remaining + forSomeone.remaining;
  const percent = Math.min(100, Math.round((done / total) * 100));
  return {
    total,
    done,
    remaining,
    percent,
    complete: remaining === 0,
    hasWork: true,
  };
}

/**
 * Dokłada zamówienia automatu ZD do postępu dnia. Bazę daje serwer (zamówienia na dziś i domknięte), więc —
 * inaczej niż harmonogram i prośby — bez zapamiętywania stanu z rana.
 */
export function withAutomatDayProgress(
  progress: DailyDayProgress,
  automat: { done: number; total: number } | null | undefined
): DailyDayProgress {
  if (!automat || automat.total <= 0) return progress;
  const done = Math.min(automat.done, automat.total);
  const a: DailyUrgentProgress = {
    total: automat.total,
    done,
    remaining: automat.total - done,
    percent: Math.round((done / automat.total) * 100),
    complete: done >= automat.total,
    hasWork: true,
  };
  const combined = combineDayProgress(progress.combined, a);
  return { ...progress, automat: a, combined, hasWork: true, complete: combined.complete };
}

export function buildDailyDayProgress(
  urgentBaseline: number | null,
  urgentRemaining: number,
  forSomeoneBaseline: number | null,
  forSomeoneRemaining: number
): DailyDayProgress {
  const urgent = computeDailyUrgentProgress(urgentBaseline, urgentRemaining);
  const forSomeone = computeDailyUrgentProgress(forSomeoneBaseline, forSomeoneRemaining);
  const combined = combineDayProgress(urgent, forSomeone);
  return {
    urgent,
    forSomeone,
    combined,
    hasWork: combined.hasWork,
    complete: combined.complete,
  };
}
