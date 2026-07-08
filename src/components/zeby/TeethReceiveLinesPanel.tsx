"use client";
import { TEETH_RECEIVE_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";
import { isUndoExpired, undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import type { DeliveryUndoPayload } from "@/lib/orders/receive-queue-undo";
import { collectDeliveryNotificationQueueIds } from "@/lib/orders/receive-queue-undo";
import {
  actionBatchUpdateDelivered,
  actionUndoDelivery,
  actionUpdateDelivered,
} from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { UndoToast } from "@/components/ui/UndoToast";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { Button } from "@/components/ui/Button";
import { IconTooth } from "@/components/icons/StrokeIcons";
import { SupplierFilterChips } from "@/components/queue/SupplierFilterChips";
import { ReceiveQueueSearchField } from "@/components/queue/ReceiveQueueSearchField";
import { ReceiveQueueActiveFilters } from "@/components/queue/ReceiveQueueActiveFilters";
import { TeethReceiveLinesSection } from "@/components/zeby/TeethReceiveLinesSection";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { useTeethUpdates } from "@/components/zeby/TeethUpdatesContext";
import { cn } from "@/lib/cn";
import { teethPanelFiltersBarClass } from "@/lib/teeth/teeth-panel-ui";
import { receiveQueueToolbarSectionClass } from "@/lib/ui/queue-panel-styles";
import { useDeliveryNotificationFlush, cancelScheduledNotificationFlushes } from "@/lib/client/use-delivery-notification-flush";
import {
  filterReceiveQueueTable,
  receiveQueueProductSearchEmptyTitle,
  receiveQueueSearchToolbarLabel,
} from "@/lib/orders/receive-queue-search";
import { searchQueryTokens } from "@/lib/orders/my-order-search";
import { TEETH_RECEIVE_PANEL_COPY, buildTeethReceiveQueue } from "@/lib/orders/receive-queue-teeth";
import {
  orderHasIncompleteTeethSpec,
  orderHasTeethList,
} from "@/lib/teeth/teeth-panel-filters";
import {
  teethPanelProductLineLabelForOrder,
  teethPanelReadinessContextFromMaps,
} from "@/lib/teeth/teeth-panel-order-readiness";
import {
  buildTeethReceiveDeliveryUpdates,
  buildTeethReceiveFlatRows,
  countTeethReceiveOrdersByProductLine,
  groupTeethReceiveByProductLine,
  lineQtyForOrder,
  teethReceiveClampManualSessionQty,
  teethReceiveClearSessionInputForOrders,
  teethReceiveFillSessionForOrders,
  teethReceiveHasAnySessionInput,
  teethReceiveOrderHasSessionInput,
  teethReceiveOrderIdsWithSessionInput,
  teethReceiveRowKey,
  type TeethReceiveFlatRow,
} from "@/lib/teeth/teeth-receive-lines";
import {
  setTeethReceiveLineQty,
  teethReceiveGroupKey,
  teethReceiveGroupsFromOrder,
  teethReceiveLineRemaining,
  teethReceiveRemaining,
} from "@/lib/teeth/teeth-receive-picker";
import { useSupplierGroupCollapse } from "@/lib/orders/use-supplier-group-collapse";
import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import {
  batchDeliveryConfirmMessage,
  formatDeliveryBatchToast,
  requiresQueueBatchConfirm,
} from "@/lib/orders/queue-batch-notify";
import type { ReceiveQueueToast } from "@/components/queue/ReceiveQueueTable";

function filterOrdersByProductLine(
  orders: IndividualOrder[],
  productLineFilter: string,
  productLineLabel: (order: IndividualOrder) => string,
): IndividualOrder[] {
  if (!productLineFilter) return orders;
  return orders.filter((order) => productLineLabel(order) === productLineFilter);
}

export function TeethReceiveLinesPanel({
  deliveryOrders,
  onToast,
  onPendingChange,
}: {
  deliveryOrders: IndividualOrder[];
  onToast: (toast: ReceiveQueueToast) => void;
  onPendingChange: (message: string | null) => void;
}) {
  const router = useRouter();
  const teethUpdates = useTeethUpdates();
  const undoShortcut = useUndoShortcutLabel();
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );
  const productLineLabel = useCallback(
    (order: IndividualOrder) =>
      teethPanelProductLineLabelForOrder(order, readinessCtx) ?? "Inna linia",
    [readinessCtx],
  );
  const canPickSpec = useCallback(
    (order: IndividualOrder) =>
      orderHasTeethList(order) && !orderHasIncompleteTeethSpec(order, readinessCtx),
    [readinessCtx],
  );

  const { blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    onToast(toastFromError(text)),
  );
  const [pending, start] = useTransition();
  const [flatLineQty, setFlatLineQty] = useState<Record<string, string>>({});
  const [manualQty, setManualQty] = useState<Record<string, string>>({});
  const [productLineFilter, setProductLineFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResetToken, setProductSearchResetToken] = useState(0);
  const [batchSaveConfirm, setBatchSaveConfirm] = useState<{
    orderIds: string[];
    fullQuantity?: boolean;
  } | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState<{
    groupKey: string;
    orderIds: string[];
  } | null>(null);
  const [refreshConfirm, setRefreshConfirm] = useState(false);
  const [undo, setUndo] = useState<DeliveryUndoPayload | null>(null);
  const [undoError, setUndoError] = useState<ToastNotice | null>(null);
  useDeliveryNotificationFlush(undo);
  const undoInFlightRef = useRef(false);

  const clearUndo = useCallback(() => {
    setUndo(null);
    setUndoError(null);
  }, []);

  const receiveQueue = useMemo(() => buildTeethReceiveQueue(deliveryOrders), [deliveryOrders]);

  const hasUnsavedInput = useMemo(
    () => teethReceiveHasAnySessionInput(receiveQueue, flatLineQty, manualQty, canPickSpec),
    [receiveQueue, flatLineQty, manualQty, canPickSpec],
  );

  useEffect(() => {
    if (!hasUnsavedInput) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedInput]);

  const handleUndo = useCallback(() => {
    if (!undo || undoInFlightRef.current) return;
    setUndoError(null);
    if (isUndoExpired(undo.expiresAt)) {
      setUndoError(TEETH_RECEIVE_TOAST.undoExpired);
      return;
    }
    undoInFlightRef.current = true;
    start(async () => {
      try {
        onPendingChange("Cofanie przyjęcia zębów…");
        cancelScheduledNotificationFlushes(
          collectDeliveryNotificationQueueIds(undo.token.snapshots)
        );
        await actionUndoDelivery(undo);
        clearUndo();
        router.refresh();
        teethUpdates?.refreshNow();
        onToast(TEETH_RECEIVE_TOAST.undoSuccess);
      } catch (e) {
        setUndoError(
          toastFromError(
            e instanceof Error ? e.message : undefined,
            TEETH_RECEIVE_TOAST.undoFailed.text
          )
        );
      } finally {
        undoInFlightRef.current = false;
        onPendingChange(null);
      }
    });
  }, [undo, clearUndo, onPendingChange, onToast, router, teethUpdates]);

  useEffect(() => {
    if (!undo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      handleUndo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, handleUndo]);

  const { filtered, zdScoped } = useMemo(() => {
    const byLine = filterOrdersByProductLine(receiveQueue, productLineFilter, productLineLabel);
    const zdScoped = filterReceiveQueueTable(byLine, {
      supplierFilter: "",
      zdProfile: null,
      productSearch: "",
    });
    const filtered =
      productSearch.trim().length > 0
        ? filterReceiveQueueTable(byLine, {
            supplierFilter: "",
            zdProfile: null,
            productSearch,
          })
        : zdScoped;
    return { filtered, zdScoped };
  }, [receiveQueue, productLineFilter, productLineLabel, productSearch]);

  const productSearchActive = searchQueryTokens(productSearch).length > 0;
  const productLineChips = useMemo(
    () =>
      countTeethReceiveOrdersByProductLine(receiveQueue, readinessCtx).map((chip) => ({
        key: chip.label,
        count: chip.count,
      })),
    [receiveQueue, readinessCtx],
  );
  const productLineGroups = useMemo(
    () => groupTeethReceiveByProductLine(filtered, readinessCtx),
    [filtered, readinessCtx],
  );
  const collapseGroups = useMemo<SupplierOrderGroup[]>(
    () =>
      productLineGroups.map((group) => ({
        supplierKey: group.groupKey,
        orders: group.orders,
      })),
    [productLineGroups],
  );
  const collapse = useSupplierGroupCollapse(collapseGroups, productLineFilter, {
    collapseMode: "smart",
  });

  const clearProductSearch = () => {
    setProductSearch("");
    setProductSearchResetToken((t) => t + 1);
  };

  const handleLineQtyChange = (row: TeethReceiveFlatRow, rawValue: string) => {
    if (row.kind !== "spec") return;
    const groups = teethReceiveGroupsFromOrder(
      (row.order.teeth_details ?? []).map((d) => ({
        position: d.position,
        color: d.color,
        mould: d.mould,
        jaw: d.jaw,
        kind: d.kind,
      })),
    );
    const remaining = teethReceiveRemaining(row.order, groups);
    const lineMax = teethReceiveLineRemaining(row.order, row.group, groups);
    setFlatLineQty((s) => {
      const lineQty = lineQtyForOrder(row.orderId, s);
      const nextLine = setTeethReceiveLineQty(
        groups,
        lineQty,
        row.groupKey,
        rawValue,
        remaining,
        lineMax,
      );
      const next = { ...s };
      for (const group of groups) {
        const gk = teethReceiveGroupKey(group);
        const rk = teethReceiveRowKey(row.orderId, gk);
        const val = nextLine[gk];
        if (val) next[rk] = val;
        else delete next[rk];
      }
      return next;
    });
  };

  const handleToggleLine = (row: TeethReceiveFlatRow, checked: boolean) => {
    if (row.kind !== "spec") return;
    const groups = teethReceiveGroupsFromOrder(
      (row.order.teeth_details ?? []).map((d) => ({
        position: d.position,
        color: d.color,
        mould: d.mould,
        jaw: d.jaw,
        kind: d.kind,
      })),
    );
    const lineRem = teethReceiveLineRemaining(row.order, row.group, groups);
    handleLineQtyChange(row, checked && lineRem > 0 ? String(lineRem) : "");
  };

  const handleManualQtyChange = (order: IndividualOrder, rawValue: string) => {
    const next = teethReceiveClampManualSessionQty(order, rawValue);
    setManualQty((s) => {
      if (!next) {
        const copy = { ...s };
        delete copy[order.id];
        return copy;
      }
      return { ...s, [order.id]: next };
    });
  };

  const saveOrders = (orderIds: string[], opts?: { fullQuantity?: boolean }) => {
    if (blockIfReadOnly()) return;

    let workingFlat = { ...flatLineQty };
    let workingManual = { ...manualQty };

    if (opts?.fullQuantity) {
      const filled = teethReceiveFillSessionForOrders(
        receiveQueue.filter((o) => orderIds.includes(o.id)),
        workingFlat,
        workingManual,
        canPickSpec,
      );
      workingFlat = filled.flatLineQty;
      workingManual = filled.manualQty;
    }

    const updates = buildTeethReceiveDeliveryUpdates(
      receiveQueue.filter((o) => orderIds.includes(o.id)),
      workingFlat,
      workingManual,
      canPickSpec,
    );

    if (!updates.length) {
      onToast(TEETH_RECEIVE_TOAST.batchNoQuantity);
      return;
    }

    onPendingChange(updates.length > 1 ? "Zbiorczy zapis dostaw…" : "Zapisywanie dostawy…");
    start(async () => {
      try {
        if (updates.length === 1) {
          const only = updates[0]!;
          const result = await actionUpdateDelivered(
            only.orderId,
            only.qty,
            only.teethLineDelivered,
          );
          if (result.undo) {
            setUndoError(null);
            setUndo(result.undo);
          }
          const order = receiveQueue.find((o) => o.id === only.orderId);
          onToast(
            TEETH_RECEIVE_TOAST.lineSaved(order?.sales_person?.name ?? "handlowiec")
          );
        } else {
          const result = await actionBatchUpdateDelivered(updates);
          if ("error" in result) {
            onToast(toastFromError(result.error));
            return;
          }
          if (result.undo) {
            setUndoError(null);
            setUndo(result.undo);
          }
          onToast(formatDeliveryBatchToast(result));
        }

        setFlatLineQty({});
        setManualQty({});
        router.refresh();
        teethUpdates?.refreshNow();
      } catch (e) {
        onToast(
          toastFromError(
            e instanceof Error ? e.message : undefined,
            TEETH_RECEIVE_TOAST.saveFailed.text
          )
        );
      } finally {
        onPendingChange(null);
      }
    });
  };

  const requestSaveBatch = (orderIds: string[], opts?: { fullQuantity?: boolean }) => {
    if (requiresQueueBatchConfirm(orderIds) || opts?.fullQuantity) {
      setBatchSaveConfirm({ orderIds, fullQuantity: opts?.fullQuantity });
      return;
    }
    saveOrders(orderIds, opts);
  };

  const handleFillSalesPerson = (orders: IndividualOrder[]) => {
    const filled = teethReceiveFillSessionForOrders(
      orders,
      flatLineQty,
      manualQty,
      canPickSpec,
    );
    setFlatLineQty(filled.flatLineQty);
    setManualQty(filled.manualQty);
  };

  const requestToggleSection = (groupKey: string, orderIds: string[]) => {
    if (collapse.isExpanded(groupKey)) {
      const sectionOrders = receiveQueue.filter((order) => orderIds.includes(order.id));
      const unsavedIds = teethReceiveOrderIdsWithSessionInput(
        sectionOrders,
        flatLineQty,
        manualQty,
        canPickSpec,
      );
      if (unsavedIds.length > 0) {
        setDiscardConfirm({ groupKey, orderIds });
        return;
      }
    }
    collapse.toggle(groupKey);
  };

  const requestRefresh = () => {
    if (hasUnsavedInput) {
      setRefreshConfirm(true);
      return;
    }
    teethUpdates?.refreshNow();
  };

  if (receiveQueue.length === 0) {
    return (
      <EmptyState
        title={TEETH_RECEIVE_PANEL_COPY.emptyTitle}
        description={TEETH_RECEIVE_PANEL_COPY.emptyDescription}
        icon={<IconTooth size={24} strokeWidth={1.75} />}
      />
    );
  }

  return (
    <>
      {undo ? (
        <UndoToast
          title="Przyjęto zęby"
          description={undoWindowBannerDescription(
            "Cofnięcie przywraca stan u handlowca w /moje"
          )}
          placement="floating"
          expiresAt={undo.expiresAt}
          onDismiss={clearUndo}
          onUndo={() => void handleUndo()}
          undoLabel="Cofnij przyjęcie"
          undoShortcut={undoShortcut}
        />
      ) : null}
      {undoError ? (
        <NoticeToast
          notice={undoError}
          stacked={Boolean(undo)}
          onDismiss={() => setUndoError(null)}
        />
      ) : null}

      <ConfirmDialog
        open={discardConfirm != null}
        title="Niewpisane ilości w sekcji"
        message="Masz wpisane ilości, które nie zostały zapisane. Zamknąć sekcję i odrzucić te wpisy?"
        confirmLabel="Odrzuć wpisy"
        pending={pending}
        onCancel={() => setDiscardConfirm(null)}
        onConfirm={() => {
          if (!discardConfirm) return;
          const { groupKey, orderIds } = discardConfirm;
          const cleared = teethReceiveClearSessionInputForOrders(
            orderIds,
            flatLineQty,
            manualQty,
          );
          setFlatLineQty(cleared.flatLineQty);
          setManualQty(cleared.manualQty);
          setDiscardConfirm(null);
          if (collapse.isExpanded(groupKey)) collapse.toggle(groupKey);
        }}
      />

      <ConfirmDialog
        open={refreshConfirm}
        title="Odświeżyć widok?"
        message="Masz niewpisane ilości w tabeli. Odświeżenie usunie je z formularza (nie zapisze do systemu)."
        confirmLabel="Odśwież"
        pending={pending}
        onCancel={() => setRefreshConfirm(false)}
        onConfirm={() => {
          setRefreshConfirm(false);
          setFlatLineQty({});
          setManualQty({});
          teethUpdates?.refreshNow();
        }}
      />

      <ConfirmDialog
        open={batchSaveConfirm != null}
        title={
          batchSaveConfirm?.fullQuantity
            ? "Zapisać całą dostawę sekcji?"
            : "Zapisać wprowadzone ilości?"
        }
        message={
          batchSaveConfirm
            ? batchDeliveryConfirmMessage(receiveQueue, batchSaveConfirm.orderIds, {
                fullQuantity: batchSaveConfirm.fullQuantity,
                teethHandover: true,
              })
            : ""
        }
        confirmLabel={
          batchSaveConfirm
            ? batchSaveConfirm.fullQuantity
              ? `Całość (${batchSaveConfirm.orderIds.length})`
              : `Zapisz (${batchSaveConfirm.orderIds.length})`
            : "Zapisz"
        }
        pending={pending}
        onCancel={() => setBatchSaveConfirm(null)}
        onConfirm={() => {
          if (!batchSaveConfirm) return;
          const { orderIds, fullQuantity } = batchSaveConfirm;
          setBatchSaveConfirm(null);
          saveOrders(orderIds, fullQuantity ? { fullQuantity: true } : undefined);
        }}
      />

      {teethUpdates?.hasUpdates ? (
        <SystemNotice
          variant="action"
          className="mb-3"
          title="Są nowe pozycje w kolejce przyjęcia"
          description={
            hasUnsavedInput
              ? "Odśwież po zapisaniu wpisanych ilości — inaczej formularz zostanie wyczyszczony."
              : "Ktoś mógł oznaczyć zamówienia w kolejce — odśwież, żeby zobaczyć aktualną listę."
          }
          action={
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={requestRefresh}
            >
              Odśwież widok
            </Button>
          }
        />
      ) : null}

      <div className={cn(teethPanelFiltersBarClass, "border-b border-slate-200/80 py-3")}>
        <div className="space-y-3">
          <div className={cn(receiveQueueToolbarSectionClass, "border-slate-200/80 shadow-none")}>
            <ReceiveQueueSearchField
              key={`teeth-receive-search-${productSearchResetToken}`}
              onDebouncedChange={setProductSearch}
            />
            {productSearchActive ? (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <ReceiveQueueActiveFilters
                  productSearch={productSearch}
                  onClearProductSearch={clearProductSearch}
                  zdFilter={null}
                  onClearZdFilter={() => {}}
                />
                <p className="text-[11px] font-medium text-slate-700">
                  {receiveQueueSearchToolbarLabel(filtered.length, zdScoped.length, productSearch)}
                </p>
              </div>
            ) : null}
          </div>

          <div className={cn(receiveQueueToolbarSectionClass, "border-slate-200/80")}>
            <SupplierFilterChips
              chips={productLineChips}
              value={productLineFilter}
              onChange={setProductLineFilter}
              totalLabel="Wszystkie linie"
              fieldLabel="Linia produktowa"
              accentVariant="indigo"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={receiveQueueProductSearchEmptyTitle(productSearch)}
          description="Spróbuj innego zapytania albo wyczyść filtry."
        />
      ) : (
        <div className="space-y-2 py-3">
          {productLineGroups.map((group) => {
            const orderIds = group.orders.map((o) => o.id);
            const flatRows = buildTeethReceiveFlatRows(group.orders, canPickSpec);

            return (
              <TeethReceiveLinesSection
                key={group.groupKey}
                sectionTitle={group.productLineLabel}
                orderIds={orderIds}
                flatRows={flatRows}
                receiveQueue={receiveQueue}
                isOpen={collapse.isExpanded(group.groupKey)}
                onToggle={() => requestToggleSection(group.groupKey, orderIds)}
                flatLineQty={flatLineQty}
                manualQty={manualQty}
                pending={pending}
                canPickSpec={canPickSpec}
                onSaveFullGroup={() => requestSaveBatch(orderIds, { fullQuantity: true })}
                onSaveWithInput={() => {
                  const ids = orderIds.filter((id) => {
                    const order = receiveQueue.find((o) => o.id === id);
                    return (
                      order &&
                      teethReceiveOrderHasSessionInput(
                        order,
                        flatLineQty,
                        manualQty,
                        canPickSpec,
                      )
                    );
                  });
                  if (ids.length) requestSaveBatch(ids);
                }}
                onFillSalesPerson={handleFillSalesPerson}
                onLineQtyChange={handleLineQtyChange}
                onToggleLine={handleToggleLine}
                onManualQtyChange={(orderId, value) => {
                  const order = receiveQueue.find((o) => o.id === orderId);
                  if (order) handleManualQtyChange(order, value);
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
