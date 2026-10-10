"use client";

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { actionAcknowledgeZdFulfillmentDeadlineChange } from "@/app/actions/my-orders";
import { useDelegateFor } from "@/components/moje/DelegatePreviewContext";
import {
  buildZdDeadlineChangeToastMessage,
  zdDeadlineChangeToastTone,
} from "@/components/moje/zd-fulfillment-deadline-change-auto-ack-copy";
import { NoticeToast } from "@/components/ui/NoticeToast";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  collectPendingZdDeadlineChanges,
  zdDeadlineChangeNeedsClick,
  type PendingZdDeadlineChange,
} from "@/lib/orders/zd-deadline-change-pending";

export { collectPendingZdDeadlineChanges };

function buildZdDeadlineChangeAckKey(pending: PendingZdDeadlineChange[]): string {
  return pending
    .flatMap((item) => item.orderIds.map((id) => `${id}:${item.change.changedAt}`))
    .sort()
    .join("|");
}

const ZD_DEADLINE_ACK_MAX_RETRIES = 3;
const ZD_DEADLINE_ACK_RETRY_MS = 2500;

/**
 * Automatycznie potwierdza tylko pierwsze ustalenie terminu z ZD (krótki toast).
 * Przesunięcie / przyspieszenie czeka na „Przyjąłem/am” przy prośbie i jest w Pilnych sprawach.
 */
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
  const delegateFor = useDelegateFor() ?? undefined;
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

    const pending = collectPendingZdDeadlineChanges(rows).filter(
      (item) => !zdDeadlineChangeNeedsClick(item.change)
    );
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
        const result = await actionAcknowledgeZdFulfillmentDeadlineChange(orderIds, delegateFor);
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
          message: userFacingErrorText(e, "Nie udało się zapisać zmiany terminu"),
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
  }, [canAcknowledge, rows, router, tourPreview, retryNonce, delegateFor]);

  if (!toast) return null;

  return (
    <NoticeToast
      notice={{ text: toast.message, tone: toast.tone, durationMs: 4500 }}
      stacked
      onDismiss={() => setToast(null)}
    />
  );
}
