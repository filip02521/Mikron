"use client";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import {
  actionAcknowledgeWarehouseCancelDisposition,
  actionBatchUpdateDelivered,
  actionMarkInformacjaArrived,
  actionUpdateDelivered,
} from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { QueueGroupExpandControl } from "@/components/queue/QueueGroupExpandControl";
import { SupplierFilterChips } from "@/components/queue/SupplierFilterChips";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { ReceiveQueueGroupMenu } from "@/components/queue/receive-queue/ReceiveQueueGroupMenu";
import { ReceiveQueueRow } from "@/components/queue/receive-queue/ReceiveQueueRow";
import { ReceiveQueueSelectionBar } from "@/components/queue/receive-queue/ReceiveQueueSelectionBar";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import {
  getDeliveryProgress,
  isInformacjaRequest,
  parseOrderQuantity,
} from "@/lib/orders/individual";
import {
  receiveQueueTargetQuantity,
} from "@/lib/orders/sales-cancel";
import { warehouseCancelFulfillToast } from "@/lib/orders/warehouse-cancel-fulfillment";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import { MICROCOPY } from "@/lib/ui/microcopy";
import { QUEUE_LIST_BODY_CLASS } from "@/lib/ui/queue-panel-styles";
import { InlineCheck } from "@/components/ui/UiGlyphs";
import { countOrdersBySupplier, filterOrdersBySupplier } from "@/lib/orders/supplier-filter-summary";
import {
  informacjaProductKey,
  orderIdsInProductGroup,
} from "@/lib/orders/queue-product-groups";
import { buildSupplierGroupMetrics } from "@/lib/orders/supplier-group-metrics";
import { useSupplierGroupCollapse } from "@/lib/orders/use-supplier-group-collapse";
import {
  formatReceiveGroupHeaderSummary,
  groupReceiveQueueBySupplier,
  mergeReceiveQueueOrders,
  partitionReceiveSelection,
} from "@/lib/orders/receive-queue";
import {
  batchDeliveryConfirmMessage,
  batchInformacjaConfirmMessage,
  batchNotifyButtonLabel,
  formatDeliveryBatchToast,
  formatInformacjaBatchToast,
  QUEUE_EMAIL_WARNING_TOAST_MS,
  requiresQueueBatchConfirm,
  selectedSaveButtonLabel,
} from "@/lib/orders/queue-batch-notify";

const COL_COUNT = 4;

export type ReceiveQueueToast = {
  text: string;
  tone: "success" | "error";
  durationMs?: number;
};

export function ReceiveQueueTable({
  deliveryOrders,
  informacjaOrders,
  warehouseInventory,
  onToast,
  onPendingChange,
}: {
  deliveryOrders: IndividualOrder[];
  informacjaOrders: IndividualOrder[];
  warehouseInventory: IndividualOrder[];
  onToast: (toast: ReceiveQueueToast) => void;
  onPendingChange: (message: string | null) => void;
}) {
  const router = useRouter();
  const { blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    onToast({ text, tone: "error" })
  );
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [supplierFilter, setSupplierFilter] = useState("");
  const [batchSaveConfirm, setBatchSaveConfirm] = useState<{
    orderIds: string[];
    fullQuantity?: boolean;
  } | null>(null);
  const [notifyConfirmIds, setNotifyConfirmIds] = useState<string[] | null>(null);

  const receiveQueue = useMemo(
    () => mergeReceiveQueueOrders(deliveryOrders, informacjaOrders),
    [deliveryOrders, informacjaOrders]
  );

  const filtered = useMemo(
    () => filterOrdersBySupplier(receiveQueue, supplierFilter),
    [receiveQueue, supplierFilter]
  );

  const supplierChips = useMemo(() => countOrdersBySupplier(receiveQueue), [receiveQueue]);
  const supplierGroups = useMemo(() => groupReceiveQueueBySupplier(filtered), [filtered]);
  const supplierMetrics = useMemo(
    () => buildSupplierGroupMetrics(deliveryOrders, warehouseInventory),
    [deliveryOrders, warehouseInventory]
  );
  const collapse = useSupplierGroupCollapse(supplierGroups, supplierFilter, {
    collapseMode: "all",
  });

  const selectedIds = useMemo(
    () => filtered.filter((o) => selected[o.id]).map((o) => o.id),
    [filtered, selected]
  );

  const selectionParts = useMemo(
    () => partitionReceiveSelection(filtered, selectedIds),
    [filtered, selectedIds]
  );

  const getQty = useCallback((o: IndividualOrder) => {
    if (qty[o.id] !== undefined) return qty[o.id];
    const d = o.delivered_quantity;
    if (d && d !== "-") return d;
    const target = receiveQueueTargetQuantity(o);
    if (target != null && target > 0) return String(target);
    const ordered = parseOrderQuantity(o.quantity);
    if (ordered != null && ordered > 0) return String(ordered);
    return "";
  }, [qty]);

  const selectedZamowienieWithQty = useMemo(
    () => selectionParts.zamowienie.filter((o) => getQty(o).trim() !== ""),
    [selectionParts.zamowienie, getQty]
  );

  const deliveryProgressForOrder = (order: IndividualOrder, value: string) => {
    const target = receiveQueueTargetQuantity(order);
    return getDeliveryProgress(
      target != null ? String(target) : order.quantity,
      value
    );
  };

  const toggleSelected = (orderId: string) => {
    setSelected((s) => ({ ...s, [orderId]: !s[orderId] }));
  };

  const toggleSupplierGroupIds = (ids: string[], checked: boolean) => {
    setSelected((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = checked;
      return next;
    });
  };

  const toggleProductGroup = (list: IndividualOrder[], startIndex: number, checked: boolean) => {
    const ids = orderIdsInProductGroup(list, startIndex);
    setSelected((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = checked;
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? Object.fromEntries(filtered.map((o) => [o.id, true])) : {});
  };

  const clearSelection = () => setSelected({});

  const saveDelivery = (order: IndividualOrder, value: string) => {
    if (blockIfReadOnly()) return;
    onPendingChange("Zapisywanie dostawy…");
    start(async () => {
      try {
        const result = await actionUpdateDelivered(order.id, value);
        setQty((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        setSelected((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        const progress = deliveryProgressForOrder(order, value);
        const person = order.sales_person?.name ?? "handlowiec";

        if (result.emailError) {
          onToast({
            text: `Zapisano dostawę, ale e-mail nie poszedł: ${result.emailError}`,
            tone: "error",
            durationMs: QUEUE_EMAIL_WARNING_TOAST_MS,
          });
        } else if (progress.remaining === 0 && progress.hasNumericQty) {
          onToast({
            text: result.emailSent
              ? `Zrealizowano · ${person} · wysłano e-mail`
              : `Zrealizowano · ${person}`,
            tone: "success",
          });
        } else if (progress.delivered > 0 && progress.hasNumericQty) {
          onToast({
            text: result.emailSent
              ? `${progress.fractionLabel} · ${person} · brakuje ${progress.remaining} szt. · wysłano e-mail`
              : `${progress.fractionLabel} · ${person} · brakuje ${progress.remaining} szt.`,
            tone: "success",
          });
        } else {
          onToast({
            text: result.emailSent ? "Zapisano · wysłano e-mail" : "Zapisano",
            tone: "success",
          });
        }
        router.refresh();
      } catch (e) {
        onToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      } finally {
        onPendingChange(null);
      }
    });
  };

  const ackCancelDisposition = (order: IndividualOrder) => {
    if (blockIfReadOnly()) return;
    onPendingChange("Rozliczanie rezygnacji…");
    start(async () => {
      try {
        const result = await actionAcknowledgeWarehouseCancelDisposition([order.id]);
        setSelected((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        onToast({
          text:
            result.count > 0
              ? warehouseCancelFulfillToast(order)
              : "Pozycja rozliczona",
          tone: "success",
        });
        router.refresh();
      } catch (e) {
        onToast({
          text: e instanceof Error ? e.message : "Nie udało się rozliczyć",
          tone: "error",
        });
      } finally {
        onPendingChange(null);
      }
    });
  };

  const saveBatch = (orderIds: string[], opts?: { fullQuantity?: boolean }) => {
    if (blockIfReadOnly()) return;
    const updates = orderIds
      .map((id) => {
        const order = receiveQueue.find((o) => o.id === id);
        if (!order || isInformacjaRequest(order)) return null;
        const ordered = receiveQueueTargetQuantity(order);
        const value = opts?.fullQuantity && ordered != null ? String(ordered) : getQty(order);
        if (!value.trim()) return null;
        return { orderId: id, qty: value };
      })
      .filter((u): u is { orderId: string; qty: string } => u != null);

    const skippedQty = orderIds.length - updates.length;

    if (!updates.length) {
      onToast({ text: "Wpisz ilość w polu dostawy lub użyj menu grupy „Całość”.", tone: "error" });
      return;
    }

    onPendingChange(updates.length > 1 ? "Zbiorczy zapis dostaw…" : "Zapisywanie dostawy…");
    start(async () => {
      try {
        if (updates.length === 1 && orderIds.length === 1) {
          const only = updates[0]!;
          const result = await actionUpdateDelivered(only.orderId, only.qty);
          setSelected((s) => {
            const next = { ...s };
            delete next[only.orderId];
            return next;
          });
          setQty((s) => {
            const next = { ...s };
            delete next[only.orderId];
            return next;
          });
          const order = receiveQueue.find((o) => o.id === only.orderId);
          const person = order?.sales_person?.name ?? "handlowiec";
          onToast({
            text: result.emailError
              ? `Zapisano, ale e-mail: ${result.emailError}`
              : result.emailSent
                ? `Zapisano · ${person} · wysłano mail`
                : `Zapisano · ${person}`,
            tone: result.emailError ? "error" : "success",
            durationMs: result.emailError ? QUEUE_EMAIL_WARNING_TOAST_MS : undefined,
          });
        } else {
          const result = await actionBatchUpdateDelivered(updates);
          if ("error" in result) {
            onToast({ text: result.error, tone: "error" });
            return;
          }
          setSelected((s) => {
            const next = { ...s };
            for (const id of result.savedOrderIds) delete next[id];
            return next;
          });
          setQty((s) => {
            const next = { ...s };
            for (const id of result.savedOrderIds) delete next[id];
            return next;
          });
          const toast = formatDeliveryBatchToast(result);
          if (skippedQty > 0) {
            toast.text += ` · ${skippedQty} bez ilości (pominięto)`;
            toast.tone = "error";
          }
          onToast(toast);
        }
        router.refresh();
      } catch (e) {
        onToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
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
    saveBatch(orderIds, opts);
  };

  const markInformacja = (orderIds: string[]) => {
    if (blockIfReadOnly()) return;
    onPendingChange(
      orderIds.length > 1 ? "Wysyłanie powiadomień…" : "Powiadamianie handlowca…"
    );
    start(async () => {
      try {
        const r = await actionMarkInformacjaArrived(orderIds);
        if ("error" in r) {
          onToast({ text: r.error, tone: "error" });
          return;
        }
        setSelected((s) => {
          const next = { ...s };
          for (const id of orderIds) delete next[id];
          return next;
        });
        onToast(formatInformacjaBatchToast(r));
        router.refresh();
      } catch (e) {
        onToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      } finally {
        onPendingChange(null);
      }
    });
  };

  const requestMarkInformacja = (orderIds: string[]) => {
    if (requiresQueueBatchConfirm(orderIds)) {
      setNotifyConfirmIds(orderIds);
      return;
    }
    markInformacja(orderIds);
  };

  const zamowienieIdsInGroup = (groupOrders: IndividualOrder[]) =>
    groupOrders.filter((o) => !isInformacjaRequest(o)).map((o) => o.id);

  const informacjaIdsInGroup = (groupOrders: IndividualOrder[]) =>
    groupOrders.filter(isInformacjaRequest).map((o) => o.id);

  const allSelected = filtered.length > 0 && filtered.every((o) => selected[o.id]);

  if (!receiveQueue.length) {
    return (
      <EmptyState
        title={MICROCOPY.empty.queue.title}
        description={MICROCOPY.empty.queue.description}
      />
    );
  }

  if (!filtered.length) {
    return (
      <>
        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <SupplierFilterChips
            chips={supplierChips}
            value={supplierFilter}
            onChange={setSupplierFilter}
            totalLabel="Wszyscy"
          />
        </div>
        <EmptyState
          title={MICROCOPY.empty.queue.filterTitle}
          description={MICROCOPY.empty.queue.filterDescription}
        />
      </>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={batchSaveConfirm != null}
        title={
          batchSaveConfirm?.fullQuantity
            ? "Zapisać całą dostawę grupy?"
            : "Zapisać zaznaczone zamówienia?"
        }
        message={
          batchSaveConfirm
            ? batchDeliveryConfirmMessage(receiveQueue, batchSaveConfirm.orderIds, {
                fullQuantity: batchSaveConfirm.fullQuantity,
              })
            : ""
        }
        confirmLabel={
          batchSaveConfirm
            ? batchSaveConfirm.fullQuantity
              ? batchNotifyButtonLabel(receiveQueue, batchSaveConfirm.orderIds, {
                  prefix: "Całość",
                })
              : selectedSaveButtonLabel(batchSaveConfirm.orderIds.length)
            : "Zapisz"
        }
        pending={pending}
        onCancel={() => setBatchSaveConfirm(null)}
        onConfirm={() => {
          if (!batchSaveConfirm) return;
          const { orderIds, fullQuantity } = batchSaveConfirm;
          setBatchSaveConfirm(null);
          saveBatch(orderIds, fullQuantity ? { fullQuantity: true } : undefined);
        }}
      />

      <ConfirmDialog
        open={notifyConfirmIds != null}
        title="Wysłać powiadomienia informacyjne?"
        message={
          notifyConfirmIds
            ? batchInformacjaConfirmMessage(receiveQueue, notifyConfirmIds)
            : ""
        }
        confirmLabel={
          notifyConfirmIds
            ? `Wyślij powiadomienia (${notifyConfirmIds.length})`
            : "Wyślij"
        }
        pending={pending}
        onCancel={() => setNotifyConfirmIds(null)}
        onConfirm={() => {
          if (!notifyConfirmIds) return;
          const ids = notifyConfirmIds;
          setNotifyConfirmIds(null);
          markInformacja(ids);
        }}
      />

      <div className="border-b border-slate-100 px-4 py-2 sm:px-6">
        <SupplierFilterChips
          chips={supplierChips}
          value={supplierFilter}
          onChange={setSupplierFilter}
          totalLabel="Wszyscy"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 text-[10px] leading-relaxed text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              zamówienie: wpisz ilość, Enter lub <InlineCheck size={10} className="inline align-[-2px]" />
            </span>
            <span className="mx-1.5 text-slate-300" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
              informacja: przycisk powiadomienia lub zaznaczenie wielu
            </span>
          </p>
          <QueueGroupExpandControl
            groupCount={supplierGroups.length}
            allExpanded={collapse.allExpanded}
            onExpandAll={collapse.expandAll}
            onCollapseAll={collapse.collapseAll}
          />
        </div>
      </div>

      <ReceiveQueueSelectionBar
        zamowienie={selectionParts.zamowienie}
        informacja={selectionParts.informacja}
        canSaveZamowienie={selectedZamowienieWithQty.length > 0}
        pending={pending}
        onSaveZamowienie={() =>
          requestSaveBatch(selectionParts.zamowienie.map((o) => o.id))
        }
        onNotifyInformacja={() =>
          requestMarkInformacja(selectionParts.informacja.map((o) => o.id))
        }
        onClear={clearSelection}
      />

      <TableScroll className="px-0 pb-0">
        <div className={QUEUE_LIST_BODY_CLASS}>
          <DataTable className="queue-table receive-queue-table">
            <thead>
              <tr>
              <th className="w-9">
                <input
                  type="checkbox"
                  className={checkboxBrandClass}
                  checked={allSelected}
                  disabled={pending}
                  aria-label="Zaznacz wszystkie pozycje"
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="min-w-[7rem]">Handlowiec</th>
              <th>Produkt</th>
              <th className="w-[9.5rem] text-right">Realizacja</th>
            </tr>
          </thead>
          <tbody>
            {supplierGroups.map((group, groupIndex) => {
              const groupIds = group.orders.map((o) => o.id);
              const groupAllSelected =
                groupIds.length > 0 && groupIds.every((id) => selected[id]);
              const isOpen = collapse.isExpanded(group.supplierKey);
              const summary = formatReceiveGroupHeaderSummary(
                group.orders,
                supplierMetrics.get(group.supplierKey)
              );
              const zamIds = zamowienieIdsInGroup(group.orders);
              const infoIds = informacjaIdsInGroup(group.orders);

              return (
                <Fragment key={`receive-group-${groupIndex}`}>
                  <SupplierGroupHeaderRow
                    colSpan={COL_COUNT}
                    groupIndex={groupIndex}
                    group={group}
                    summary={summary}
                    isOpen={isOpen}
                    onToggle={() => collapse.toggle(group.supplierKey)}
                    variant="delivery"
                    actions={
                      <ReceiveQueueGroupMenu
                        groupIds={groupIds}
                        groupAllSelected={groupAllSelected}
                        zamIds={zamIds}
                        infoIds={infoIds}
                        receiveQueue={receiveQueue}
                        pending={pending}
                        onToggleSelectAll={(checked) =>
                          toggleSupplierGroupIds(groupIds, checked)
                        }
                        onSaveFullZamowienie={() =>
                          requestSaveBatch(zamIds, { fullQuantity: true })
                        }
                        onNotifyInformacja={() => requestMarkInformacja(infoIds)}
                      />
                    }
                  />
                  {isOpen
                    ? group.orders.map((o, rowIndex) => {
                        const isInfo = isInformacjaRequest(o);
                        const prevKey =
                          rowIndex > 0
                            ? informacjaProductKey(group.orders[rowIndex - 1]!)
                            : null;
                        const isFirstInProductGroup =
                          informacjaProductKey(o) !== prevKey;
                        const productGroupIds =
                          isInfo && isFirstInProductGroup
                            ? orderIdsInProductGroup(group.orders, rowIndex).filter((id) =>
                                group.orders.find(
                                  (x) => x.id === id && isInformacjaRequest(x)
                                )
                              )
                            : [];
                        const productGroupAllSelected =
                          productGroupIds.length > 0 &&
                          productGroupIds.every((id) => selected[id]);
                        const ordered = receiveQueueTargetQuantity(o);
                        const inputVal = getQty(o);

                        return (
                          <ReceiveQueueRow
                            key={o.id}
                            order={o}
                            groupIndex={groupIndex}
                            rowIndex={rowIndex}
                            isInfo={isInfo}
                            isFirstInProductGroup={isFirstInProductGroup}
                            productGroupIds={productGroupIds}
                            productGroupAllSelected={productGroupAllSelected}
                            selected={!!selected[o.id]}
                            pending={pending}
                            inputVal={inputVal}
                            onToggleSelected={() => toggleSelected(o.id)}
                            onQtyChange={(value) =>
                              setQty((s) => ({ ...s, [o.id]: value }))
                            }
                            onSaveDelivery={() => saveDelivery(o, inputVal)}
                            onFillFullQty={() => {
                              if (ordered == null) return;
                              saveDelivery(o, String(ordered));
                            }}
                            onNotifyInformacja={requestMarkInformacja}
                            onToggleProductGroup={(checked) =>
                              toggleProductGroup(group.orders, rowIndex, checked)
                            }
                            onAckCancelDisposition={() => ackCancelDisposition(o)}
                          />
                        );
                      })
                    : null}
                </Fragment>
              );
            })}
            </tbody>
          </DataTable>
        </div>
      </TableScroll>
    </>
  );
}
