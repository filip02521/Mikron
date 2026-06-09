"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  actionUnacknowledgeDismiss,
  actionUnacknowledgePickup,
} from "@/app/actions/my-orders";
import { UndoToast } from "@/components/ui/UndoToast";
import { undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";

export type ShipmentUndoState = {
  orderIds: string[];
  title: string;
  kind: "pickup" | "dismiss";
};

type ShipmentUndoContextValue = {
  undo: ShipmentUndoState | null;
  reportUndo: (state: ShipmentUndoState) => void;
  clearUndo: () => void;
  handleUndo: () => void;
  disabled: boolean;
};

const ShipmentUndoContext = createContext<ShipmentUndoContextValue | null>(null);

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
  const [, start] = useTransition();

  const clearUndo = useCallback(() => setUndo(null), []);

  const reportUndo = useCallback(
    (state: ShipmentUndoState) => {
      if (disabled) return;
      setUndo(state);
    },
    [disabled]
  );

  const handleUndo = useCallback(() => {
    if (!undo || disabled) return;
    const snapshot = undo;
    start(async () => {
      try {
        if (snapshot.kind === "dismiss") {
          await actionUnacknowledgeDismiss(snapshot.orderIds);
        } else {
          await actionUnacknowledgePickup(snapshot.orderIds);
        }
        setUndo(null);
        router.refresh();
      } catch {
        setUndo(snapshot);
        router.refresh();
      }
    });
  }, [undo, disabled, router]);

  return (
    <ShipmentUndoContext.Provider
      value={{ undo, reportUndo, clearUndo, handleUndo, disabled }}
    >
      {children}
    </ShipmentUndoContext.Provider>
  );
}

/** Toast cofnięcia — umieść raz nad listą (np. przed paskiem zbiorczego odbioru). */
export function MyOrderShipmentUndoToast({ className }: { className?: string }) {
  const ctx = useContext(ShipmentUndoContext);
  if (!ctx?.undo || ctx.disabled) return null;
  return (
    <UndoToast
      title={ctx.undo.title}
      description={undoWindowBannerDescription()}
      placement="inline"
      className={className ?? "mb-0"}
      onDismiss={ctx.clearUndo}
      onUndo={ctx.handleUndo}
    />
  );
}

export function useMyOrderShipmentUndo(): ShipmentUndoContextValue {
  const ctx = useContext(ShipmentUndoContext);
  if (!ctx) {
    throw new Error("useMyOrderShipmentUndo wymaga MyOrderShipmentUndoProvider");
  }
  return ctx;
}
