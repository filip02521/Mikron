export type ScheduledFlush = {
  queueIds: string[];
  expiresAt: number;
};

/** Opóźnienie do wysyłki po wygaśnięciu okna cofania (+250 ms buforu). */
export function computeNotificationFlushDelay(expiresAt: number, now = Date.now()): number {
  return Math.max(250, expiresAt - now + 250);
}

export type DeliveryNotificationFlushSchedulerDeps = {
  now?: () => number;
  setTimer: (fn: () => void, delayMs: number) => number;
  clearTimer: (id: number) => void;
  onFlush: (queueId: string) => void;
};

export function createDeliveryNotificationFlushScheduler(
  deps: DeliveryNotificationFlushSchedulerDeps
) {
  const timers = new Map<string, number>();
  const now = deps.now ?? (() => Date.now());

  function schedule(batch: ScheduledFlush): void {
    const delay = computeNotificationFlushDelay(batch.expiresAt, now());
    for (const queueId of batch.queueIds) {
      const existing = timers.get(queueId);
      if (existing != null) deps.clearTimer(existing);

      const timerId = deps.setTimer(() => {
        timers.delete(queueId);
        deps.onFlush(queueId);
      }, delay);
      timers.set(queueId, timerId);
    }
  }

  function cancel(queueIds: string[]): void {
    for (const queueId of queueIds) {
      const timerId = timers.get(queueId);
      if (timerId != null) {
        deps.clearTimer(timerId);
        timers.delete(queueId);
      }
    }
  }

  return { schedule, cancel };
}
