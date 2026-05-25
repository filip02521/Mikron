import {
  computeDailyUrgentProgress,
  mergeUrgentBaseline,
  type DailyUrgentProgress,
} from "@/lib/orders/daily-urgent-progress";

export type DailyDayProgressSegment = DailyUrgentProgress & {
  label: string;
};

export type DailyDayProgress = {
  urgent: DailyUrgentProgress;
  forSomeone: DailyUrgentProgress;
  combined: DailyUrgentProgress;
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

export function buildDailyDayProgress(
  urgentBaseline: number | null,
  urgentRemaining: number,
  forSomeoneBaseline: number | null,
  forSomeoneRemaining: number
): DailyDayProgress {
  const urgent = computeDailyUrgentProgress(
    mergeUrgentBaseline(urgentBaseline, urgentRemaining),
    urgentRemaining
  );
  const forSomeone = computeDailyUrgentProgress(
    mergeUrgentBaseline(forSomeoneBaseline, forSomeoneRemaining),
    forSomeoneRemaining
  );
  const combined = combineDayProgress(urgent, forSomeone);
  return {
    urgent,
    forSomeone,
    combined,
    hasWork: combined.hasWork,
    complete: combined.complete,
  };
}
