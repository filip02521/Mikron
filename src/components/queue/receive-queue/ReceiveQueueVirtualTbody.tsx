"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, type RefObject } from "react";
import type { IndividualOrder } from "@/types/database";
import type { SupplierOrderGroup } from "@/lib/orders/queue-supplier-groups";
import type { SupplierGroupMetrics } from "@/lib/orders/supplier-group-metrics";
import {
  buildReceiveQueueVirtualItems,
  estimateReceiveQueueVirtualItemSize,
} from "@/lib/orders/receive-queue-virtual-items";
import { RECEIVE_QUEUE_VIRTUAL_THRESHOLD } from "@/lib/ui/virtual-list-config";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { ReceiveQueueGroupMenu } from "@/components/queue/receive-queue/ReceiveQueueGroupMenu";
import { ReceiveQueueRow } from "@/components/queue/receive-queue/ReceiveQueueRow";
import { formatReceiveGroupHeaderSummary } from "@/lib/orders/receive-queue";
import { isInformacjaRequest } from "@/lib/orders/individual";
import {
  informacjaProductKey,
  orderIdsInProductGroup,
} from "@/lib/orders/queue-product-groups";
import { receiveQueueTargetQuantity } from "@/lib/orders/sales-cancel";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { calculateBusinessDays, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { useWindowScrollMargin } from "@/hooks/useWindowScrollMargin";

const COL_COUNT = 4;

function maxWaitingDaysForGroup(orders: IndividualOrder[]): number | null {
  const today = todayInWarsaw();
  let max: number | null = null;
  for (const order of orders) {
    if (isInformacjaRequest(order)) continue;
    const placement = orderPlacementAt(order);
    if (!placement) continue;
    const start = parseDateOnly(placement);
    if (!start || start > today) continue;
    const days = calculateBusinessDays(start, today);
    if (max == null || days > max) max = days;
  }
  return max;
}

function queueTableScrollMarginOffset(table: HTMLElement): number {
  const thead = table.querySelector("thead");
  const theadHeight = thead?.getBoundingClientRect().height ?? 0;
  return table.getBoundingClientRect().top + window.scrollY + theadHeight;
}

export function ReceiveQueueVirtualTbody({
  tableRef,
  supplierGroups,
  supplierMetrics,
  supplierScheduleMap,
  collapse,
  selected,
  pending,
  productSearchActive,
  productSearch,
  receiveQueue,
  getQty,
  zamowienieIdsInGroup,
  informacjaIdsInGroup,
  toggleSupplierGroupIds,
  requestSaveBatch,
  requestMarkInformacja,
  toggleSelected,
  setQty,
  saveDelivery,
  toggleProductGroup,
  ackCancelDisposition,
  renderClassic,
}: {
  /** Tabela — punkt odniesienia scrollMargin (scroll strony, nie wewnętrzny panel). */
  tableRef: RefObject<HTMLTableElement | null>;
  supplierGroups: SupplierOrderGroup[];
  supplierMetrics: Map<string, SupplierGroupMetrics>;
  supplierScheduleMap: Map<string, string | null>;
  collapse: { isExpanded: (key: string) => boolean; toggle: (key: string) => void };
  selected: Record<string, boolean>;
  pending: boolean;
  productSearchActive: boolean;
  productSearch: string;
  receiveQueue: IndividualOrder[];
  getQty: (order: IndividualOrder) => string;
  zamowienieIdsInGroup: (orders: IndividualOrder[]) => string[];
  informacjaIdsInGroup: (orders: IndividualOrder[]) => string[];
  toggleSupplierGroupIds: (ids: string[], checked: boolean) => void;
  requestSaveBatch: (ids: string[], opts?: { fullQuantity?: boolean }) => void;
  requestMarkInformacja: (ids: string[]) => void;
  toggleSelected: (orderId: string) => void;
  setQty: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveDelivery: (order: IndividualOrder, value: string) => void;
  toggleProductGroup: (list: IndividualOrder[], startIndex: number, checked: boolean) => void;
  ackCancelDisposition: (order: IndividualOrder) => void;
  renderClassic: () => React.ReactNode;
}) {
  const virtualItems = buildReceiveQueueVirtualItems(supplierGroups, (key) =>
    collapse.isExpanded(key)
  );
  const enabled = virtualItems.length >= RECEIVE_QUEUE_VIRTUAL_THRESHOLD;
  const layoutKey = `${supplierGroups.length}\0${virtualItems.length}\0${pending}`;

  const scrollMargin = useWindowScrollMargin(
    tableRef,
    enabled,
    layoutKey,
    queueTableScrollMarginOffset
  );

  const virtualizer = useWindowVirtualizer({
    count: enabled ? virtualItems.length : 0,
    scrollMargin,
    estimateSize: (index) => estimateReceiveQueueVirtualItemSize(virtualItems[index]!),
    overscan: 14,
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when layout or rows change
  }, [enabled, layoutKey, scrollMargin, selected, productSearchActive, productSearch]);

  if (!enabled) {
    return <tbody>{renderClassic()}</tbody>;
  }

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
      : 0;

  return (
    <tbody>
      {paddingTop > 0 ? (
        <tr aria-hidden>
          <td colSpan={COL_COUNT} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {virtualRows.map((virtualRow) => {
        const item = virtualItems[virtualRow.index]!;
        const measureRef = virtualizer.measureElement;
        const dataIndex = virtualRow.index;

        if (item.kind === "supplier-header") {
          const group = item.group;
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
            <SupplierGroupHeaderRow
              key={item.key}
              colSpan={COL_COUNT}
              groupIndex={item.groupIndex}
              group={group}
              summary={summary}
              isOpen={isOpen}
              onToggle={() => collapse.toggle(group.supplierKey)}
              variant="delivery"
              scheduleDate={supplierScheduleMap.get(group.supplierKey) ?? null}
              maxWaitingDays={maxWaitingDaysForGroup(group.orders)}
              rowRef={measureRef}
              dataIndex={dataIndex}
              actions={
                <ReceiveQueueGroupMenu
                  groupIds={groupIds}
                  groupAllSelected={groupAllSelected}
                  zamIds={zamIds}
                  infoIds={infoIds}
                  receiveQueue={receiveQueue}
                  pending={pending}
                  onToggleSelectAll={(checked) => toggleSupplierGroupIds(groupIds, checked)}
                  onSaveFullZamowienie={() => requestSaveBatch(zamIds, { fullQuantity: true })}
                  onNotifyInformacja={() => requestMarkInformacja(infoIds)}
                />
              }
            />
          );
        }

        const group = supplierGroups[item.groupIndex]!;
        const o = item.order;
        const rowIndex = item.rowIndex;
        const isLastInGroup = rowIndex === group.orders.length - 1;
        const isInfo = isInformacjaRequest(o);
        const prevKey =
          rowIndex > 0 ? informacjaProductKey(group.orders[rowIndex - 1]!) : null;
        const isFirstInProductGroup = informacjaProductKey(o) !== prevKey;
        const productGroupIds =
          isInfo && isFirstInProductGroup
            ? orderIdsInProductGroup(group.orders, rowIndex).filter((id) =>
                group.orders.find((x) => x.id === id && isInformacjaRequest(x))
              )
            : [];
        const productGroupAllSelected =
          productGroupIds.length > 0 && productGroupIds.every((id) => selected[id]);
        const targetQty = receiveQueueTargetQuantity(o);
        const inputVal = getQty(o);

        return (
          <ReceiveQueueRow
            key={item.key}
            order={o}
            groupIndex={item.groupIndex}
            rowIndex={rowIndex}
            isInfo={isInfo}
            isFirstInProductGroup={isFirstInProductGroup}
            productGroupIds={productGroupIds}
            productGroupAllSelected={productGroupAllSelected}
            selected={!!selected[o.id]}
            pending={pending}
            inputVal={inputVal}
            searchQuery={productSearchActive ? productSearch : null}
            onToggleSelected={() => toggleSelected(o.id)}
            onQtyChange={(value) => setQty((s) => ({ ...s, [o.id]: value }))}
            onSaveDelivery={() => saveDelivery(o, inputVal)}
            onFillFullQty={() => {
              if (targetQty == null) return;
              saveDelivery(o, String(targetQty));
            }}
            onNotifyInformacja={requestMarkInformacja}
            onToggleProductGroup={(checked) =>
              toggleProductGroup(group.orders, rowIndex, checked)
            }
            onAckCancelDisposition={() => ackCancelDisposition(o)}
            isLastInGroup={isLastInGroup}
            rowRef={measureRef}
            dataIndex={dataIndex}
          />
        );
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden>
          <td colSpan={COL_COUNT} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </tbody>
  );
}
