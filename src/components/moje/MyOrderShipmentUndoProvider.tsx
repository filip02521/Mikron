"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  actionUnacknowledgeDismiss,
  actionUnacknowledgePickup,
  actionUnacknowledgeSalesCancel,
} from "@/app/actions/my-orders";
import { UndoToast } from "@/components/ui/UndoToast";
import { NoticeToast } from "@/components/ui/NoticeToast";
import {
  isUndoExpired,
  undoExpiresAtNow,
  undoWindowBannerDescription,
} from "@/lib/orders/daily-panel-undo";
import type { SalesCancelUndoRestore } from "@/lib/orders/sales-cancel-db";
import type { TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import {
  MY_ORDERS_TOAST,
  toastFromError,
  type ToastNotice,
} from "@/lib/ui/notice-copy";

export type ShipmentUndoReport = {
  orderIds: string[];
  title: string;
  kind: "pickup" | "dismiss" | "cancel";
  /** Migawka przed rezygnacją — przywraca poprzednią częściową rezygnację przy cofnięciu. */
  restoreById?: Record<string, SalesCancelUndoRestore>;
  /** Lista zębów sprzed wycofania grup — tylko actionSalesCancelTeethGroups. */
  teethDetailsById?: Record<string, TeethLineDetail[]>;
};

type ShipmentUndoState = ShipmentUndoReport & { expiresAt: number };

type ShipmentUndoContextValue = {
  undo: ShipmentUndoState | null;
  reportUndo: (state: ShipmentUndoReport) => void;
  clearUndo: () => void;
  handleUndo: () => void;
  disabled: boolean;
};

const ShipmentUndoContext = createContext<ShipmentUndoContextValue | null>(null);

function shipmentUndoCopy(state: ShipmentUndoState): {
  undoLabel: string;
  description: string;
} {
  if (state.kind === "pickup") {
    return {
      undoLabel: "Cofnij odbiór",
      description: undoWindowBannerDescription("Towar wróci na listę gotowych"),
    };
  }
  if (state.kind === "cancel") {
    return {
      undoLabel: "Cofnij anulowanie",
      description: undoWindowBannerDescription("Pozycja wróci na listę"),
    };
  }
  return {
    undoLabel: "Cofnij ukrycie",
    description: undoWindowBannerDescription("Prośba wróci na listę"),
  };
}

function undoFailureFallback(kind: ShipmentUndoState["kind"]): ToastNotice {
  if (kind === "pickup") return MY_ORDERS_TOAST.undoPickupFailed;
  if (kind === "cancel") return MY_ORDERS_TOAST.undoCancelFailed;
  return MY_ORDERS_TOAST.undoDismissFailed;
}

/** Jeden toast cofnięcia na widoku /moje — unika duplikatów z wielu list. */
export function MyOrderShipmentUndoProvider({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [undo, setUndo] = useState<ShipmentUndoState | null>(null);
  const [feedback, setFeedback] = useState<ToastNotice | null>(null);
  const undoInFlightRef = useRef(false);
  const [, start] = useTransition();
  const undoShortcut = useUndoShortcutLabel();

  const clearUndo = useCallback(() => {
    setUndo(null);
    setFeedback(null);
  }, []);

  const reportUndo = useCallback(
    (state: ShipmentUndoReport) => {
      if (disabled) return;
      setFeedback(null);
      setUndo({ ...state, expiresAt: undoExpiresAtNow() });
    },
    [disabled]
  );

  const handleUndo = useCallback(() => {
    if (!undo || disabled || undoInFlightRef.current) return;
    const snapshot = undo;
    if (isUndoExpired(snapshot.expiresAt)) {
      setUndo(null);
      setFeedback(MY_ORDERS_TOAST.undoExpired);
      return;
    }
    setFeedback(null);
    undoInFlightRef.current = true;
    start(async () => {
      try {
        if (snapshot.kind === "dismiss") {
          await actionUnacknowledgeDismiss(snapshot.orderIds);
        } else if (snapshot.kind === "cancel") {
          await actionUnacknowledgeSalesCancel(snapshot.orderIds, {
            restoreById: snapshot.restoreById,
            teethDetailsById: snapshot.teethDetailsById,
          });
        } else {
          await actionUnacknowledgePickup(snapshot.orderIds);
        }
        setUndo(null);
        setFeedback(MY_ORDERS_TOAST.undoSuccess);
        router.refresh();
      } catch (e) {
        if (!isUndoExpired(snapshot.expiresAt)) setUndo(snapshot);
        const fallback = undoFailureFallback(snapshot.kind);
        setFeedback(
          toastFromError(e instanceof Error ? e.message : undefined, fallback.text)
        );
        router.refresh();
      } finally {
        undoInFlightRef.current = false;
      }
    });
  }, [undo, disabled, router]);

  useEffect(() => {
    if (!undo || disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      handleUndo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, disabled, handleUndo]);

  const toastPortal =
    !disabled && typeof document !== "undefined"
      ? createPortal(
          <>
            {undo ? (
              <UndoToast
                title={undo.title}
                description={shipmentUndoCopy(undo).description}
                undoLabel={shipmentUndoCopy(undo).undoLabel}
                undoShortcut={undoShortcut}
                placement="floating"
                expiresAt={undo.expiresAt}
                onDismiss={clearUndo}
                onUndo={handleUndo}
              />
            ) : null}
            {feedback ? (
              <NoticeToast
                notice={feedback}
                stacked={Boolean(undo)}
                tone={feedback.tone}
                onDismiss={() => setFeedback(null)}
              />
            ) : null}
          </>,
          document.body
        )
      : null;

  return (
    <ShipmentUndoContext.Provider
      value={{
        undo,
        reportUndo,
        clearUndo,
        handleUndo,
        disabled,
      }}
    >
      {children}
      {toastPortal}
    </ShipmentUndoContext.Provider>
  );
}

export function useMyOrderShipmentUndo(): ShipmentUndoContextValue {
  const ctx = useContext(ShipmentUndoContext);
  if (!ctx) {
    throw new Error("useMyOrderShipmentUndo wymaga MyOrderShipmentUndoProvider");
  }
  return ctx;
}
