"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { actionAcknowledgeZdFulfillmentDeadlineChange } from "@/app/actions/my-orders";
import {
  buildZdDeadlineChangeToastMessage,
  zdDeadlineChangeToastTone,
  type PendingZdDeadlineChange,
} from "@/components/moje/zd-fulfillment-deadline-change-auto-ack-copy";
import { NoticeToast } from "@/components/ui/NoticeToast";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { ZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";

export function collectPendingZdDeadlineChanges(rows: MyOrderRow[]): PendingZdDeadlineChange[] {
  const pending: PendingZdDeadlineChange[] = [];

  for (const row of rows) {
    const lineChanges = row.lines.filter((line) => line.zdFulfillment?.deadlineChange);
    const change: ZdFulfillmentDeadlineChangeDisplay | null | undefined =
      row.zdFulfillment?.deadlineChange ?? lineChanges[0]?.zdFulfillment?.deadlineChange;
    if (!change) continue;

    const orderIds = lineChanges.length
      ? lineChanges.map((line) => line.id)
      : row.orderIds;
    if (!orderIds.length) continue;

    pending.push({
      orderIds,
      supplierName: row.supplierName,
      change,
    });
  }

  return pending;
}

function buildZdDeadlineChangeAckKey(pending: PendingZdDeadlineChange[]): string {
  return pending
    .flatMap((item) => item.orderIds.map((id) => `${id}:${item.change.changedAt}`))
    .sort()
    .join("|");
}

const ZD_DEADLINE_ACK_MAX_RETRIES = 3;
const ZD_DEADLINE_ACK_RETRY_MS = 2500;

/** Automatycznie potwierdza zmianę terminu ZD i pokazuje krótki toast — bez klikania „Rozumiem”. */
export function ZdFulfillmentDeadlineChangeAutoAck({
  rows,
  canAcknowledge,
  tourPreview = false,
}: {
  rows: MyOrderRow[];
  canAcknowledge: boolean;
  tourPreview?: boolean;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "warning";
  } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const processedKeyRef = useRef<string>("");
  const inFlightRef = useRef(false);
  const queuedKeyRef = useRef<string | null>(null);
  const failedAttemptsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!canAcknowledge || tourPreview) return;

    const pending = collectPendingZdDeadlineChanges(rows);
    if (!pending.length) return;

    const orderIds = [...new Set(pending.flatMap((item) => item.orderIds))];
    const key = buildZdDeadlineChangeAckKey(pending);
    if (!key || key === processedKeyRef.current) return;
    if (inFlightRef.current) {
      queuedKeyRef.current = key;
      return;
    }

    const failedAttempts = failedAttemptsRef.current[key] ?? 0;
    if (failedAttempts >= ZD_DEADLINE_ACK_MAX_RETRIES) return;

    processedKeyRef.current = key;
    inFlightRef.current = true;

    void (async () => {
      try {
        const result = await actionAcknowledgeZdFulfillmentDeadlineChange(orderIds);
        delete failedAttemptsRef.current[key];
        if (result.count > 0) {
          setToast({
            message: buildZdDeadlineChangeToastMessage(pending),
            tone: zdDeadlineChangeToastTone(pending),
          });
        } else {
          processedKeyRef.current = "";
        }
        router.refresh();
      } catch (e) {
        const nextAttempts = (failedAttemptsRef.current[key] ?? 0) + 1;
        failedAttemptsRef.current[key] = nextAttempts;
        processedKeyRef.current = "";
        setToast({
          message:
            e instanceof Error ? e.message : "Nie udało się zapisać zmiany terminu",
          tone: "warning",
        });
        if (nextAttempts < ZD_DEADLINE_ACK_MAX_RETRIES) {
          window.setTimeout(() => setRetryNonce((value) => value + 1), ZD_DEADLINE_ACK_RETRY_MS);
        }
      } finally {
        inFlightRef.current = false;
        const queued = queuedKeyRef.current;
        if (queued && queued !== processedKeyRef.current) {
          queuedKeyRef.current = null;
          setRetryNonce((value) => value + 1);
        }
      }
    })();
  }, [canAcknowledge, rows, router, tourPreview, retryNonce]);

  if (!toast) return null;

  return (
    <NoticeToast
      notice={{ message: toast.message, tone: toast.tone, durationMs: 4500 }}
      stacked
      onDismiss={() => setToast(null)}
    />
  );
}
