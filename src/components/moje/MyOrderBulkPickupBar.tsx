"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  actionAcknowledgePickup,
} from "@/app/actions/my-orders";
import { useMyOrderPickupShelfDialog } from "@/components/moje/MyOrderPickupShelfDialogProvider";
import { markPickupShelfNoticeSeen } from "@/lib/orders/my-order-pickup-shelf-notice";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { useMyOrderShipmentUndo } from "@/components/moje/MyOrderShipmentUndoProvider";
import { Toast } from "@/components/ui/Toast";
import { myOrderPickupAckLabel, myOrderPickupAckTitle } from "@/lib/orders/my-order-pickup-ack-copy";
import { formatPickupLineCount } from "@/lib/orders/my-order-plural";
import { IconPackageCheck } from "@/components/icons/StrokeIcons";
import { mojeActionBarShellClass } from "@/lib/ui/surfaces";
import { panelSegmentLastClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

/**
 * Zbiorczy odbiór ponad kartami — jeden klik potwierdza wszystkie prośby
 * „Do odbioru” z sekcji akcji. Montowany na stałe (poza warunkową sekcją),
 * żeby undo przeżyło zniknięcie ostatniego wiersza po odświeżeniu.
 */
export function MyOrderBulkPickupBar({
  rows,
  enabled,
  tourPreview = false,
  inPickupFocus = false,
}: {
  rows: MyOrderRow[];
  enabled: boolean;
  tourPreview?: boolean;
  /** Filtr „Gotowe” aktywny — bez powtarzania opisu w pasku. */
  inPickupFocus?: boolean;
}) {
  const router = useRouter();
  const { requestShelfPickupNotice } = useMyOrderPickupShelfDialog();
  const { reportUndo } = useMyOrderShipmentUndo();
  const [pending, start] = useTransition();
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const { pickupRowCount, pickupIds } = useMemo(() => {
    const pickupRows = rows.filter(
      (r) => r.acknowledgeMode === "pickup" && r.pickupPendingIds.length > 0
    );
    const ids = pickupRows.flatMap((r) => r.pickupPendingIds);
    return {
      pickupRowCount: pickupRows.length,
      pickupIds: ids,
      pickupLineCount: ids.length,
    };
  }, [rows]);

  if (!enabled || tourPreview) return null;

  const runBulk = (orderIds: string[]) => {
    start(async () => {
      try {
        await actionAcknowledgePickup(orderIds);
        markPickupShelfNoticeSeen();
        reportUndo({
          orderIds,
          kind: "pickup",
          title:
            orderIds.length === 1
              ? "Odbiór zapisany"
              : `Odbiór ${orderIds.length} poz. zapisany`,
        });
        router.refresh();
      } catch (e) {
        setErrorToast(
          e instanceof Error ? e.message : "Nie udało się potwierdzić odbioru"
        );
      }
    });
  };

  const showBar = pickupRowCount >= 2;

  if (!showBar && !errorToast) return null;

  return (
    <>
      {errorToast ? (
        <Toast
          message={errorToast}
          tone="error"
          onDismiss={() => setErrorToast(null)}
        />
      ) : null}
      {showBar ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border border-emerald-200/90 bg-emerald-50/80 px-3 py-2.5 sm:px-4",
            inPickupFocus ? "justify-end" : "justify-between"
          )}
        >
          {!inPickupFocus ? (
            <p className="flex min-w-0 items-center gap-2 text-xs font-medium text-emerald-950">
              <IconPackageCheck
                size={16}
                strokeWidth={2.25}
                className="shrink-0 text-emerald-700"
                aria-hidden
              />
              <span className="min-w-0">
                {formatPickupLineCount(pickupIds.length)} gotowych
                {pickupRowCount >= 2 ? " — potwierdź wszystkie naraz." : "."}
              </span>
            </p>
          ) : null}
          <div className={mojeActionBarShellClass}>
            <MyOrderAckButton
              variant="segmentPrimary"
              className={panelSegmentLastClass}
              disabled={pending}
              title={myOrderPickupAckTitle(pickupIds.length)}
              onClick={() => requestShelfPickupNotice(pickupIds, () => runBulk(pickupIds))}
            >
              {pending
                ? "Potwierdzanie…"
                : inPickupFocus
                  ? `Potwierdź wszystkie (${pickupIds.length})`
                  : myOrderPickupAckLabel(pickupIds.length, "pickup", { compact: true })}
            </MyOrderAckButton>
          </div>
        </div>
      ) : null}
    </>
  );
}
