"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { sortMyOrderRows } from "@/lib/orders/my-order-sales-ui";
import {
  actionAcknowledgePickup,
  actionAcknowledgeCancelled,
  actionAcknowledgeSalesCancelNotice,
  actionSalesCancelOrders,
  actionUpdateSalesClientName,
} from "@/app/actions/my-orders";
import {
  salesCancelConfirmForLines,
  type SalesCancelLineContext,
} from "@/lib/orders/sales-cancel";
import type { SalesClientAssignment } from "@/lib/orders/sales-client-label";
import { MyOrderShipmentCard } from "@/components/moje/MyOrderShipmentCard";
import { Button } from "@/components/ui/Button";
import {
  mojeShipmentListClass,
  mojeShipmentSectionShellClass,
  type MojeShipmentRowVisualTone,
} from "@/lib/ui/moje-shipment-row-styles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SalesPartialCancelDialog } from "@/components/moje/SalesPartialCancelDialog";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import type { SalesCancelUndoRestore } from "@/lib/orders/sales-cancel-db";
import { useMyOrderPickupShelfDialog } from "@/components/moje/MyOrderPickupShelfDialogProvider";
import { useMyOrderShipmentUndo } from "@/components/moje/MyOrderShipmentUndoProvider";
import { Toast } from "@/components/ui/Toast";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import type { EditIndividualRequestInitial } from "@/components/orders/EditIndividualRequestModal";
import { editInitialFromMyOrderRow } from "@/lib/orders/individual-request-edit-ui";
import {
  searchQueryTokens,
  shouldAutoExpandOrderLinesForSearch,
} from "@/lib/orders/my-order-search";
import {
  markPickupShelfNoticeSeen,
} from "@/lib/orders/my-order-pickup-shelf-notice";
import { cn } from "@/lib/cn";
import { mojeControlHeightClass } from "@/lib/ui/ontime-theme";
import {
  MOJE_SHIPMENT_ROW_ESTIMATE_PX,
  MOJE_SHIPMENT_VIRTUAL_THRESHOLD,
} from "@/lib/ui/virtual-list-config";
import { VirtualList } from "@/components/ui/VirtualList";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { MyOrderSectionPatternId } from "@/lib/orders/my-order-section-callout";

const EditIndividualRequestModal = dynamic(
  () =>
    import("@/components/orders/EditIndividualRequestModal").then((mod) => ({
      default: mod.EditIndividualRequestModal,
    })),
  { ssr: false }
);

type CancelConfirmState = {
  orderIds: string[];
  lines: SalesCancelLineContext[];
};

type PartialCancelConfirmState = {
  orderId: string;
  phase: SalesCancelPhase;
  product: string;
  maxQty: number;
  defaultQty: number;
  deliveredQty: number;
};

export function MyOrderShipmentList({
  rows,
  listKind,
  showProgress,
  canAcknowledge,
  cardIdPrefix,
  suppliers = [],
  embedded = false,
  continuation = false,
  searchQuery,
  tourPreview = false,
  compactActionLayout = false,
  suppressedSectionPatterns,
  preserveRowOrder = false,
  rowVisualTone = "default",
  focusRowIds,
  subiektReachable = true,
}: {
  rows: MyOrderRow[];
  listKind: "zamowienie" | "informacja";
  showProgress: boolean;
  canAcknowledge: boolean;
  cardIdPrefix?: (rowId: string) => string;
  suppliers?: OrderFormSupplierOption[];
  /** Wewnątrz wspólnej obwódki sekcji (bez drugiego rounded-md). */
  embedded?: boolean;
  /** Kolejna lista w tej samej sekcji — separator u góry. */
  continuation?: boolean;
  searchQuery?: string | null;
  tourPreview?: boolean;
  compactActionLayout?: boolean;
  suppressedSectionPatterns?: Set<MyOrderSectionPatternId>;
  preserveRowOrder?: boolean;
  rowVisualTone?: MojeShipmentRowVisualTone;
  focusRowIds?: ReadonlySet<string>;
  subiektReachable?: boolean;
}) {
  const router = useRouter();
  const sortedRows = useMemo(
    () => (preserveRowOrder ? rows : sortMyOrderRows(rows)),
    [preserveRowOrder, rows]
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const allExpanded =
    sortedRows.length > 0 && sortedRows.every((r) => expandedIds.has(r.id));

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(sortedRows.map((r) => r.id)));
  }, [sortedRows]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const focusRowIdsKey = focusRowIds?.size
    ? [...focusRowIds].sort().join("\0")
    : "";
  const [appliedFocusRowIdsKey, setAppliedFocusRowIdsKey] = useState(focusRowIdsKey);
  if (focusRowIdsKey !== appliedFocusRowIdsKey) {
    setAppliedFocusRowIdsKey(focusRowIdsKey);
    if (focusRowIds?.size) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const row of sortedRows) {
          if (focusRowIds.has(row.id) && !next.has(row.id)) {
            next.add(row.id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }

  const searchActive = searchQueryTokens(searchQuery).length > 0;
  /** Stan rozwinięć sprzed pierwszego znaku wyszukiwania — przywracany po wyczyszczeniu. */
  const preSearchExpandedRef = useRef<Set<string> | null>(null);
  const searchExpandedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!searchActive) {
      if (preSearchExpandedRef.current !== null) {
        setExpandedIds(new Set(preSearchExpandedRef.current));
        preSearchExpandedRef.current = null;
      }
      searchExpandedIdsRef.current = new Set();
      return;
    }

    const idsToExpand = new Set(
      sortedRows
        .filter((r) => shouldAutoExpandOrderLinesForSearch(r, searchQuery))
        .map((r) => r.id)
    );
    const prevAuto = searchExpandedIdsRef.current;
    const toCollapse = [...prevAuto].filter((id) => !idsToExpand.has(id));
    const toExpand = [...idsToExpand].filter((id) => !prevAuto.has(id));
    searchExpandedIdsRef.current = idsToExpand;

    setExpandedIds((prev) => {
      if (preSearchExpandedRef.current === null) {
        preSearchExpandedRef.current = new Set(prev);
      }
      if (!toCollapse.length && !toExpand.length) return prev;
      const next = new Set(prev);
      for (const id of toCollapse) next.delete(id);
      for (const id of toExpand) next.add(id);
      return next;
    });
  }, [searchActive, searchQuery, sortedRows]);

  const [pending, start] = useTransition();
  const { shelfNoticeOpen, requestShelfPickupNotice } = useMyOrderPickupShelfDialog();
  const { reportUndo } = useMyOrderShipmentUndo();
  const ackPending = pending || shelfNoticeOpen;
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<CancelConfirmState | null>(
    null
  );
  const [partialCancel, setPartialCancel] = useState<PartialCancelConfirmState | null>(
    null
  );
  const [editTarget, setEditTarget] = useState<{
    orderIds: string[];
    initial: EditIndividualRequestInitial;
  } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const runPickup = useCallback(
    (orderIds: string[], options?: { markShelfNotice?: boolean }) => {
      if (tourPreview || !orderIds.length) return;
      const n = orderIds.length;
      setPendingMessage(n === 1 ? "Potwierdzanie odbioru…" : `Potwierdzanie ${n} pozycji…`);
      start(async () => {
        try {
          await actionAcknowledgePickup(orderIds);
          if (options?.markShelfNotice) markPickupShelfNoticeSeen();
          reportUndo({
            orderIds,
            kind: "pickup",
            title:
              n === 1 ? "Odbiór zapisany" : `Odbiór ${n} poz. zapisany`,
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
    [router, tourPreview, reportUndo]
  );

  const requestPickup = useCallback(
    (orderIds: string[], shelfPickup = false) => {
      if (tourPreview || !orderIds.length) return;
      const proceed = () =>
        runPickup(orderIds, shelfPickup ? { markShelfNotice: true } : undefined);
      if (shelfPickup) {
        requestShelfPickupNotice(orderIds, proceed);
        return;
      }
      proceed();
    },
    [runPickup, requestShelfPickupNotice, tourPreview]
  );

  const runAcknowledgeCancelled = useCallback(
    (orderIds: string[]) => {
      if (tourPreview) return;
      const n = orderIds.length;
      setPendingMessage(
        n === 1 ? "Potwierdzanie anulowania…" : `Potwierdzanie ${n} anulowań…`
      );
      start(async () => {
        try {
          await actionAcknowledgeCancelled(orderIds);
          reportUndo({
            orderIds,
            kind: "dismiss",
            title:
              n === 1
                ? "Anulowanie potwierdzone — ukryto z listy"
                : `Potwierdzono ${n} poz. — ukryto z listy`,
          });
          router.refresh();
        } catch (e) {
          setErrorToast(
            e instanceof Error ? e.message : "Nie udało się potwierdzić anulowania"
          );
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router, tourPreview, reportUndo]
  );

  const runAcknowledgeCancelNotice = useCallback(
    (orderIds: string[]) => {
      if (tourPreview) return;
      const n = orderIds.length;
      setPendingMessage(
        n === 1
          ? "Potwierdzanie informacji o rezygnacji…"
          : `Potwierdzanie ${n} informacji o rezygnacji…`
      );
      start(async () => {
        try {
          await actionAcknowledgeSalesCancelNotice(orderIds);
          reportUndo({
            orderIds,
            kind: "dismiss",
            title:
              n === 1
                ? "Rezygnacja potwierdzona — ukryto z listy"
                : `Potwierdzono ${n} poz. — ukryto z listy`,
          });
          router.refresh();
        } catch (e) {
          setErrorToast(
            e instanceof Error
              ? e.message
              : "Nie udało się potwierdzić informacji o rezygnacji"
          );
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router, tourPreview, reportUndo]
  );

  const saveClient = useCallback(
    async (orderId: string, patch: SalesClientAssignment) => {
      if (tourPreview) return;
      setPendingMessage("Zapisywanie klienta…");
      start(async () => {
        try {
          await actionUpdateSalesClientName(orderId, patch.clientName, patch.clientKhId);
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
    [router, tourPreview]
  );

  const runCancel = useCallback(
    (orderIds: string[], quantityById?: Record<string, number>) => {
      if (tourPreview) return;
      const n = orderIds.length;
      const restoreById: Record<string, SalesCancelUndoRestore> = {};
      for (const row of sortedRows) {
        for (const line of row.lines) {
          if (orderIds.includes(line.id)) {
            restoreById[line.id] = line.salesCancelUndoRestore;
          }
        }
      }
      setPendingMessage(n === 1 ? "Anulowanie pozycji…" : `Anulowanie ${n} pozycji…`);
      start(async () => {
        try {
          await actionSalesCancelOrders(orderIds, { quantityById });
          reportUndo({
            orderIds,
            kind: "cancel",
            title: n === 1 ? "Pozycja wycofana" : `${n} poz. wycofane`,
            restoreById,
          });
          router.refresh();
        } catch (e) {
          setErrorToast(
            e instanceof Error
              ? e.message
              : n === 1
                ? "Nie udało się anulować pozycji"
                : "Nie udało się anulować wybranych pozycji"
          );
        } finally {
          setPendingMessage(null);
        }
      });
    },
    [router, tourPreview, reportUndo, sortedRows]
  );

  const requestPartialCancel = useCallback(
    (
      orderId: string,
      phase: SalesCancelPhase,
      opts: {
        product: string;
        maxQty: number;
        defaultQty: number;
        deliveredQty?: number;
      }
    ) => {
      if (tourPreview) return;
      setPartialCancel({
        orderId,
        phase,
        deliveredQty: opts.deliveredQty ?? 0,
        ...opts,
      });
    },
    [tourPreview]
  );

  const requestCancel = useCallback(
    (orderIds: string[], lines: SalesCancelLineContext[]) => {
      if (tourPreview) return;
      setCancelConfirm({ orderIds, lines });
    },
    [tourPreview]
  );

  const handleEditRequest = useCallback((row: MyOrderRow) => {
    const initial = editInitialFromMyOrderRow(row);
    if (!initial) return;
    setEditTarget({ orderIds: row.orderIds, initial });
  }, []);

  const handleToggleRow = useCallback(
    (rowId: string) => {
      toggleExpanded(rowId);
    },
    [toggleExpanded]
  );

  const mojeVirtualEnabled = sortedRows.length >= MOJE_SHIPMENT_VIRTUAL_THRESHOLD;
  const expandedIdsKey = useMemo(
    () => [...expandedIds].sort().join("\0"),
    [expandedIds]
  );
  const focusScrollKey = useMemo(() => {
    if (!focusRowIds?.size) return null;
    return [...focusRowIds][0] ?? null;
  }, [focusRowIds]);

  const renderShipmentCard = useCallback(
    (row: MyOrderRow, as: "li" | "div" = "li") => (
      <MyOrderShipmentCard
        as={as}
        key={row.id}
        domId={cardIdPrefix?.(row.id)}
        row={row}
        listKind={listKind}
        showProgress={showProgress}
        canAcknowledge={canAcknowledge}
        pending={ackPending}
        expanded={expandedIds.has(row.id)}
        onToggleRow={handleToggleRow}
        onAcknowledgePickup={requestPickup}
        onAcknowledgeCancelled={
          canAcknowledge && row.cancelledAckOrderIds.length
            ? runAcknowledgeCancelled
            : undefined
        }
        onAcknowledgeCancelNotice={
          canAcknowledge && row.cancelNoticeOrderIds.length
            ? runAcknowledgeCancelNotice
            : undefined
        }
        onCancelRequest={
          canAcknowledge && row.salesCancelOrderIds.length && row.salesCancelPhase
            ? requestCancel
            : undefined
        }
        onPartialCancelRequest={
          canAcknowledge && row.salesCancelOrderIds.length
            ? requestPartialCancel
            : undefined
        }
        onSaveClient={canAcknowledge ? saveClient : undefined}
        onEditRequest={canAcknowledge && !tourPreview ? handleEditRequest : undefined}
        searchQuery={searchQuery}
        tourPreview={tourPreview}
        compactActionLayout={compactActionLayout}
        suppressedSectionPatterns={suppressedSectionPatterns}
        rowVisualTone={rowVisualTone}
        highlighted={focusRowIds?.has(row.id) ?? false}
        subiektReachable={subiektReachable}
      />
    ),
    [
      ackPending,
      canAcknowledge,
      cardIdPrefix,
      compactActionLayout,
      expandedIds,
      focusRowIds,
      handleEditRequest,
      handleToggleRow,
      listKind,
      requestCancel,
      requestPartialCancel,
      requestPickup,
      rowVisualTone,
      runAcknowledgeCancelNotice,
      runAcknowledgeCancelled,
      saveClient,
      searchQuery,
      showProgress,
      subiektReachable,
      suppressedSectionPatterns,
      tourPreview,
    ]
  );

  if (!sortedRows.length) return null;

  const listBody = (
    <>
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="section" />
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
              Archiwum
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
      {partialCancel ? (
        <SalesPartialCancelDialog
          key={`${partialCancel.orderId}-${partialCancel.defaultQty}`}
          open
          product={partialCancel.product}
          phase={partialCancel.phase}
          maxQty={partialCancel.maxQty}
          defaultQty={partialCancel.defaultQty}
          deliveredQty={partialCancel.deliveredQty}
          pending={pending}
          onCancel={() => {
            if (!pending) setPartialCancel(null);
          }}
          onConfirm={(quantity) => {
            const { orderId } = partialCancel;
            setPartialCancel(null);
            runCancel([orderId], { [orderId]: quantity });
          }}
        />
      ) : null}
      {cancelConfirm ? (
        <ConfirmDialog
          open
          danger
          tier="stack"
          pending={pending}
          {...(() => {
            const copy = salesCancelConfirmForLines(cancelConfirm.lines);
            return {
              title: copy.title,
              message: copy.message,
              confirmLabel: copy.confirmLabel,
            };
          })()}
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
      {sortedRows.length > 1 ? (
        <div className="flex justify-end border-b border-slate-100 px-3 py-1.5 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(mojeControlHeightClass, "px-3 text-xs font-semibold")}
            onClick={() => (allExpanded ? collapseAll() : expandAll())}
          >
            {allExpanded ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
          </Button>
        </div>
      ) : null}
      <VirtualList
        items={sortedRows}
        threshold={MOJE_SHIPMENT_VIRTUAL_THRESHOLD}
        enabled={mojeVirtualEnabled}
        bareItems
        listClassName={cn(
          mojeShipmentListClass,
          continuation && "border-t border-slate-100"
        )}
        estimateSize={(_, row) =>
          expandedIds.has(row.id) ? 240 : MOJE_SHIPMENT_ROW_ESTIMATE_PX
        }
        getItemKey={(row) => row.id}
        scrollToKey={focusScrollKey}
        remeasureKey={expandedIdsKey}
        renderItem={(row) => renderShipmentCard(row, mojeVirtualEnabled ? "div" : "li")}
      />
    </>
  );

  if (embedded) {
    return <div className="relative">{listBody}</div>;
  }

  return (
    <div className={cn("relative", mojeShipmentSectionShellClass)}>{listBody}</div>
  );
}
