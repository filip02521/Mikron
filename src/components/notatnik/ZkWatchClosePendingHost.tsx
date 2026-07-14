"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  actionAcknowledgeAndCloseZkWatch,
  actionFetchZkWatchClosePendingPreview,
} from "@/app/actions/my-orders";
import { actionCloseZkWatch } from "@/app/actions/sales-notepad";
import { useMyOrderPickupShelfDialog } from "@/components/moje/MyOrderPickupShelfDialogProvider";
import {
  markPickupShelfNoticeSeen,
  shouldShowPickupShelfNotice,
} from "@/lib/orders/my-order-pickup-shelf-notice";
import {
  collectZkWatchPendingAckOrderIdsFromItems,
  type ZkWatchPendingAckItem,
} from "@/lib/sales/zk-watch-close-pending";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchClosePendingModal } from "./ZkWatchClosePendingModal";

export type ZkWatchClosePendingSession = {
  /** Unikalny token sesji — ponowne zamknięcie tego samego ZK po anulowaniu. */
  nonce: number;
  watch: SalesZkWatch;
  /** Zamknij modal pozycji ZK przed otwarciem podglądu zamknięcia. */
  closeLinesModal?: () => void;
  linesModalOpen?: boolean;
};

type ZkWatchClosePendingHostProps = {
  session: ZkWatchClosePendingSession | null;
  readOnly?: boolean;
  delegatePreview?: boolean;
  tourPreview?: boolean;
  onDismiss: () => void;
  onClosed: (watchId: string, closedAt: string) => void;
  onPreviewLoadingChange?: (watchId: string | null) => void;
  onFlowError?: (watchId: string, message: string | null) => void;
};

/**
 * Jedna instancja modala zamknięcia ZK z oczekującymi pozycjami — zamiast N kopii na kartach.
 */
export function ZkWatchClosePendingHost(props: ZkWatchClosePendingHostProps) {
  const { session } = props;
  if (!session) return null;
  return <ZkWatchClosePendingHostActive key={session.nonce} {...props} session={session} />;
}

function ZkWatchClosePendingHostActive({
  session,
  readOnly,
  delegatePreview = false,
  tourPreview,
  onDismiss,
  onClosed,
  onPreviewLoadingChange,
  onFlowError,
}: ZkWatchClosePendingHostProps & { session: ZkWatchClosePendingSession }) {
  const router = useRouter();
  const { requestShelfPickupNotice } = useMyOrderPickupShelfDialog();
  const watch = session.watch;
  const { linesModalOpen, closeLinesModal } = session;

  const [open, setOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [items, setItems] = useState<ZkWatchPendingAckItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const epochRef = useRef(0);

  const canEdit = !readOnly && !tourPreview;
  const delegateFor = delegatePreview ? watch.sales_person_id : undefined;

  const markClosed = useCallback(async () => {
    if (!canEdit) return;
    setError(null);
    try {
      const { closedAt } = await actionCloseZkWatch(watch.id, delegateFor);
      setOpen(false);
      onFlowError?.(watch.id, null);
      onClosed(watch.id, closedAt);
      onDismiss();
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nie udało się zamknąć sprawy.";
      setError(message);
      onFlowError?.(watch.id, message);
    }
  }, [watch.id, canEdit, delegateFor, onClosed, onDismiss, onFlowError, router]);

  const refreshPreview = useCallback(async (): Promise<ZkWatchPendingAckItem[]> => {
    setListRefreshing(true);
    try {
      const { items: next } = await actionFetchZkWatchClosePendingPreview(watch.id, delegateFor);
      setItems(next);
      return next;
    } finally {
      setListRefreshing(false);
    }
  }, [watch.id, delegateFor]);

  const runAcknowledgeAndClose = useCallback(async () => {
    if (!canEdit || acknowledging || listRefreshing) return;
    setAcknowledging(true);
    setError(null);
    try {
      const { closedAt } = await actionAcknowledgeAndCloseZkWatch(watch.id, delegateFor);
      setOpen(false);
      onFlowError?.(watch.id, null);
      onClosed(watch.id, closedAt);
      onDismiss();
      router.refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Nie udało się potwierdzić pozycji przed zamknięciem.";
      setError(message);
      onFlowError?.(watch.id, message);
      try {
        await refreshPreview();
      } catch {
        /* lista zostanie odświeżona przy ponownej próbie */
      }
      throw e;
    } finally {
      setAcknowledging(false);
    }
  }, [
    watch.id,
    canEdit,
    delegateFor,
    acknowledging,
    listRefreshing,
    onClosed,
    onDismiss,
    onFlowError,
    refreshPreview,
    router,
  ]);

  const proceedAfterShelfNotice = useCallback(async () => {
    try {
      const next = await refreshPreview();
      if (next.length === 0) {
        setOpen(false);
        await markClosed();
        return;
      }
      await runAcknowledgeAndClose();
    } catch {
      /* błąd w runAcknowledgeAndClose → actionError w modalu */
    }
  }, [markClosed, refreshPreview, runAcknowledgeAndClose]);

  const confirmPendingAndClose = useCallback(async () => {
    if (!canEdit || acknowledging || listRefreshing) return;
    const next = await refreshPreview();
    if (next.length === 0) {
      setOpen(false);
      await markClosed();
      return;
    }
    const hasRegularPickup = next.some((item) => item.kind === "pickup");
    const needsShelfNotice =
      hasRegularPickup && shouldShowPickupShelfNotice();
    if (needsShelfNotice) {
      requestShelfPickupNotice(collectZkWatchPendingAckOrderIdsFromItems(next), () => {
        markPickupShelfNoticeSeen();
        void proceedAfterShelfNotice();
      });
      return;
    }
    await runAcknowledgeAndClose();
  }, [
    canEdit,
    acknowledging,
    listRefreshing,
    refreshPreview,
    markClosed,
    requestShelfPickupNotice,
    proceedAfterShelfNotice,
    runAcknowledgeAndClose,
  ]);

  useEffect(() => {
    if (!canEdit) return;

    const epoch = ++epochRef.current;
    let cancelled = false;
    onFlowError?.(watch.id, null);
    onPreviewLoadingChange?.(watch.id);

    void (async () => {
      try {
        const { items: preview } = await actionFetchZkWatchClosePendingPreview(watch.id, delegateFor);
        if (cancelled || epochRef.current !== epoch) return;
        setItems(preview);
        if (preview.length > 0) {
          if (linesModalOpen) closeLinesModal?.();
          setOpen(true);
          void confirmPendingAndClose();
          return;
        }
        const { closedAt } = await actionCloseZkWatch(watch.id, delegateFor);
        if (cancelled || epochRef.current !== epoch) return;
        onFlowError?.(watch.id, null);
        onClosed(watch.id, closedAt);
        onDismiss();
        router.refresh();
      } catch (e) {
        if (cancelled || epochRef.current !== epoch) return;
        const message =
          e instanceof Error ? e.message : "Nie udało się sprawdzić pozycji przed zamknięciem.";
        setError(message);
        onFlowError?.(watch.id, message);
        setOpen(true);
      } finally {
        if (!cancelled && epochRef.current === epoch) {
          setPreviewLoading(false);
          onPreviewLoadingChange?.(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    watch.id,
    linesModalOpen,
    closeLinesModal,
    canEdit,
    delegateFor,
    onClosed,
    onDismiss,
    onFlowError,
    onPreviewLoadingChange,
    router,
    confirmPendingAndClose,
  ]);

  if (!open && !error) return null;

  return (
    <ZkWatchClosePendingModal
      watch={watch}
      items={items}
      readOnly={readOnly}
      tourPreview={tourPreview}
      open
      refreshing={listRefreshing || previewLoading}
      confirming={acknowledging}
      actionError={error}
      onClose={() => {
        if (acknowledging || listRefreshing || previewLoading) return;
        setOpen(false);
        setError(null);
        onFlowError?.(watch.id, null);
        onDismiss();
      }}
    />
  );
}
