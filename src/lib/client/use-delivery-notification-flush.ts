"use client";

import { useEffect, useMemo } from "react";
import {
  actionFlushDeliveryNotifications,
  actionFlushDueDeliveryNotifications,
} from "@/app/actions/admin";
import { createDeliveryNotificationFlushScheduler } from "@/lib/client/delivery-notification-flush-scheduler";
import type { DeliveryUndoPayload } from "@/lib/orders/receive-queue-undo";
import { collectDeliveryNotificationQueueIds } from "@/lib/orders/receive-queue-undo";

const browserScheduler = createDeliveryNotificationFlushScheduler({
  setTimer: (fn, delayMs) => window.setTimeout(fn, delayMs),
  clearTimer: (id) => window.clearTimeout(id),
  onFlush: (queueId) => {
    void actionFlushDeliveryNotifications([queueId]).catch(() => {
      /* błąd wysyłki — przyjęcie zostało zapisane */
    });
  },
});

/** Anuluj lokalne timery (np. tuż przed cofnięciem przyjęcia). */
export function cancelScheduledNotificationFlushes(queueIds: string[]): void {
  browserScheduler.cancel(queueIds);
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
