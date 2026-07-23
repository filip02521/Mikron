"use client";

import { useEffect, useMemo } from "react";
import {
  actionFlushDeliveryNotifications,
  actionFlushDueDeliveryNotifications,
} from "@/app/actions/admin";
import { createDeliveryNotificationFlushScheduler } from "@/lib/client/delivery-notification-flush-scheduler";
import {
  NOTIFICATION_FLUSH_MAX_ATTEMPTS,
  NOTIFICATION_FLUSH_RETRY_MS,
  shouldRetryNotificationFlush,
} from "@/lib/client/delivery-notification-flush-retry";
import type { DeliveryUndoPayload } from "@/lib/orders/receive-queue-undo";
import { collectDeliveryNotificationQueueIds } from "@/lib/orders/receive-queue-undo";

function flushDeliveryNotificationWithRetry(
  queueIds: string[],
  attempt = 0,
  scheduleRetry: (fn: () => void, delayMs: number) => number = (fn, ms) =>
    window.setTimeout(fn, ms)
): void {
  void actionFlushDeliveryNotifications(queueIds)
    .then((result) => {
      if (shouldRetryNotificationFlush(result.sent, attempt)) {
        scheduleRetry(
          () => flushDeliveryNotificationWithRetry(queueIds, attempt + 1, scheduleRetry),
          NOTIFICATION_FLUSH_RETRY_MS
        );
      }
    })
    .catch(() => {
      if (attempt + 1 < NOTIFICATION_FLUSH_MAX_ATTEMPTS) {
        scheduleRetry(
          () => flushDeliveryNotificationWithRetry(queueIds, attempt + 1, scheduleRetry),
          NOTIFICATION_FLUSH_RETRY_MS
        );
      }
    });
}

const browserScheduler = createDeliveryNotificationFlushScheduler({
  setTimer: (fn, delayMs) => window.setTimeout(fn, delayMs),
  clearTimer: (id) => window.clearTimeout(id),
  onFlush: (queueIds: string[]) => {
    flushDeliveryNotificationWithRetry(queueIds);
  },
});

/** Anuluj lokalne timery (np. tuż przed cofnięciem przyjęcia). */
export function cancelScheduledNotificationFlushes(queueIds: string[]): void {
  browserScheduler.cancel(queueIds);
}

/** Bezpiecznik — wysyła zaległe powiadomienia po wejściu w aplikację (magazyn / zęby). */
export function useDueDeliveryNotificationSafetyFlush(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void actionFlushDueDeliveryNotifications().catch(() => {
      /* ignoruj błędy w tle */
    });
  }, [enabled]);
}

/** Po przyjęciu towaru — wyślij e-maile dopiero po oknie cofania. */
export function useDeliveryNotificationFlush(undo: DeliveryUndoPayload | null): void {
  useEffect(() => {
    void actionFlushDueDeliveryNotifications().catch(() => {
      /* bezpiecznik — ignoruj błędy w tle */
    });
  }, []);

  const scheduleTarget = useMemo(() => {
    if (!undo) return null;
    const queueIds = collectDeliveryNotificationQueueIds(undo.token.snapshots);
    if (!queueIds.length) return null;
    return { queueIds, expiresAt: undo.expiresAt };
  }, [undo]);

  useEffect(() => {
    if (!scheduleTarget) return;
    browserScheduler.schedule(scheduleTarget);
    // Bez cleanup — timery żyją niezależnie od zamknięcia toastu undo.
  }, [scheduleTarget]);
}

export { flushDeliveryNotificationWithRetry };
