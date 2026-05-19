"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  actionAcknowledgePickup,
  actionSalesCancelOrders,
  actionUpdateSalesClientName,
  actionUnacknowledgePickup,
} from "@/app/actions/my-orders";
import {
  salesCancelConfirmCopy,
  salesCancelSuccessToast,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import { MyOrderShipmentCard } from "@/components/moje/MyOrderShipmentCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UndoToast } from "@/components/ui/UndoToast";
import { Toast } from "@/components/ui/Toast";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import {
  EditIndividualRequestModal,
  type EditIndividualRequestInitial,
} from "@/components/orders/EditIndividualRequestModal";
import { editInitialFromMyOrderRow } from "@/lib/orders/individual-request-edit-ui";

type UndoState = {
  orderIds: string[];
  message: string;
};

type CancelConfirmState = {
  orderIds: string[];
  phase: SalesCancelPhase;
};

export function MyOrderShipmentList({
  rows,
  showProgress,
  canAcknowledge,
  cardIdPrefix,
  suppliers = [],
}: {
  rows: MyOrderRow[];
  showProgress: boolean;
  canAcknowledge: boolean;
  cardIdPrefix?: (rowId: string) => string;
  suppliers?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<CancelConfirmState | null>(
    null
  );
  const [editTarget, setEditTarget] = useState<{
    orderIds: string[];
    initial: EditIndividualRequestInitial;
  } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const runPickup = useCallback(
    (orderIds: string[]) => {
      const n = orderIds.length;
      setPendingMessage(n === 1 ? "Potwierdzanie odbioru…" : `Potwierdzanie ${n} pozycji…`);
      start(async () => {
        try {
          await actionAcknowledgePickup(orderIds);
          setUndo({
            orderIds,
            message:
              n === 1
                ? "Odbiór zapisany — wpis zniknie z listy. Masz 5 s na cofnięcie."
                : `Odbiór ${n} poz. zapisany. Masz 5 s na cofnięcie.`,
          });
          router.refresh();
        } catch (e) {
          setErrorToast(
            e instanceof Error ? e.message : "Nie udało się potwierdzić odbioru"
          );
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router]
  );

  const saveClient = useCallback(
    async (orderId: string, name: string | null) => {
      setPendingMessage("Zapisywanie klienta…");
      start(async () => {
        try {
          await actionUpdateSalesClientName(orderId, name);
          router.refresh();
        } catch (e) {
          setErrorToast(
            e instanceof Error ? e.message : "Nie udało się zapisać klienta"
          );
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router]
  );

  const runCancel = useCallback(
    (orderIds: string[]) => {
      setPendingMessage("Anulowanie prośby…");
      start(async () => {
        try {
          await actionSalesCancelOrders(orderIds);
          setUndo(null);
          setSuccessToast(salesCancelSuccessToast());
          router.refresh();
        } catch (e) {
          setErrorToast(
            e instanceof Error ? e.message : "Nie udało się anulować prośby"
          );
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router]
  );

  const requestCancel = useCallback(
    (orderIds: string[], phase: SalesCancelPhase) => {
      setCancelConfirm({ orderIds, phase });
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (!undo) return;
    const ids = undo.orderIds;
    setPendingMessage("Cofanie potwierdzenia…");
    start(async () => {
      try {
        await actionUnacknowledgePickup(ids);
        setUndo(null);
        router.refresh();
      } catch (e) {
        setUndo(null);
        setErrorToast(
          e instanceof Error ? e.message : "Nie udało się cofnąć"
        );
        router.refresh();
      } finally {
        setPendingMessage(null);
      }
    });
  }, [undo, router]);

  return (
    <div className="relative">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="section" />
      ) : null}
      {undo ? (
        <UndoToast
          message={undo.message}
          onDismiss={() => setUndo(null)}
          onUndo={handleUndo}
          durationMs={5000}
        />
      ) : null}
      {successToast ? (
        <Toast
          message={successToast}
          tone="success"
          durationMs={6000}
          onDismiss={() => setSuccessToast(null)}
          action={
            <button
              type="button"
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2"
              onClick={() => {
                setSuccessToast(null);
                document
                  .getElementById("moje-ostatnio-zakonczone")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Przewiń do „Ostatnio zakończone”
            </button>
          }
        />
      ) : null}
      {errorToast ? (
        <Toast
          message={errorToast}
          tone="error"
          onDismiss={() => setErrorToast(null)}
        />
      ) : null}
      <EditIndividualRequestModal
        open={editTarget !== null}
        mode="sales"
        orderIds={editTarget?.orderIds ?? []}
        initial={editTarget?.initial ?? null}
        suppliers={suppliers}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          setSuccessToast("Zapisano zmiany w prośbie.");
          router.refresh();
        }}
      />
      {cancelConfirm ? (
        <ConfirmDialog
          open
          danger
          pending={pending}
          title={salesCancelConfirmCopy(cancelConfirm.phase).title}
          message={salesCancelConfirmCopy(cancelConfirm.phase).message}
          confirmLabel={salesCancelConfirmCopy(cancelConfirm.phase).confirmLabel}
          cancelLabel="Zostaw bez zmian"
          onCancel={() => {
            if (!pending) setCancelConfirm(null);
          }}
          onConfirm={() => {
            const ids = cancelConfirm.orderIds;
            setCancelConfirm(null);
            runCancel(ids);
          }}
        />
      ) : null}
      <ul className="space-y-2.5 p-3 sm:p-4">
        {rows.map((row) => (
          <li key={row.id} id={cardIdPrefix?.(row.id)}>
            <MyOrderShipmentCard
              row={row}
              showProgress={showProgress}
              canAcknowledge={canAcknowledge}
              pending={pending}
              expanded={expandedId === row.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === row.id ? null : row.id))
              }
              onAcknowledgePickup={runPickup}
              onCancelRequest={
                canAcknowledge && row.salesCancelOrderIds.length && row.salesCancelPhase
                  ? (ids, phase) => requestCancel(ids, phase)
                  : undefined
              }
              onSaveClient={canAcknowledge ? saveClient : undefined}
              onEditRequest={
                canAcknowledge
                  ? (row) => {
                      const initial = editInitialFromMyOrderRow(row);
                      if (!initial) {
                        setErrorToast("Uzupełnij dostawcę w prośbie przed edycją.");
                        return;
                      }
                      setEditTarget({ orderIds: row.orderIds, initial });
                    }
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
