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
  onFlush: (queueIds: string[]) => void;
};

type PendingBatch = {
  queueIds: Set<string>;
  timerId: number;
};

export function createDeliveryNotificationFlushScheduler(
  deps: DeliveryNotificationFlushSchedulerDeps
) {
  const pendingByQueueId = new Map<string, PendingBatch>();
  const batchesByTimerId = new Map<number, PendingBatch>();
  const now = deps.now ?? (() => Date.now());

  function removeFromBatch(queueId: string): void {
    const existing = pendingByQueueId.get(queueId);
    if (!existing) return;
    existing.queueIds.delete(queueId);
    pendingByQueueId.delete(queueId);
    if (existing.queueIds.size === 0) {
      deps.clearTimer(existing.timerId);
      batchesByTimerId.delete(existing.timerId);
    }
  }

  function schedule(batch: ScheduledFlush): void {
    const delay = computeNotificationFlushDelay(batch.expiresAt, now());

    for (const queueId of batch.queueIds) {
      removeFromBatch(queueId);
    }

    const queueIdsSet = new Set(batch.queueIds);
    const timerId = deps.setTimer(() => {
      batchesByTimerId.delete(timerId);
      for (const qid of queueIdsSet) pendingByQueueId.delete(qid);
      deps.onFlush([...queueIdsSet]);
    }, delay);

    const pending: PendingBatch = { queueIds: queueIdsSet, timerId };
    batchesByTimerId.set(timerId, pending);
    for (const queueId of batch.queueIds) {
      pendingByQueueId.set(queueId, pending);
    }
  }

  function cancel(queueIds: string[]): void {
    for (const queueId of queueIds) {
      removeFromBatch(queueId);
    }
  }

  return { schedule, cancel };
}
