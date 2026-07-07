"use client";

import { memo, type KeyboardEvent } from "react";
import type { IndividualOrder } from "@/types/database";
import { FlowChevron, InlineCheck } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { checkboxBrandClass, controlFocusClass } from "@/lib/ui/ontime-theme";
import { getDeliveryProgress, parseOrderQuantity } from "@/lib/orders/individual";
import {
  fulfillmentProgressFor,
  receiveQueueTargetQuantity,
} from "@/lib/orders/sales-cancel";
import { procurementDispositionQueueLabel } from "@/lib/orders/procurement-disposition";
import {
  canAcknowledgeWarehouseCancelDisposition,
  isCancelledDispositionInReceiveQueue,
  needsReceiveBeforeWarehouseCancelAck,
  warehouseCancelFulfillButtonLabel,
} from "@/lib/orders/warehouse-cancel-fulfillment";
import { informacjaWarehouseQueueActionLabel } from "@/lib/orders/informacja-warehouse-queue";
import { partialReceiveCrossLabel } from "@/lib/orders/warehouse-cross-link";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import {
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
} from "@/lib/orders/queue-supplier-groups";

function NotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 3.5a5.5 5.5 0 0 1 5.5 5.5v2.2l1.2 2.4H3.3l1.2-2.4v-2.2A5.5 5.5 0 0 1 10 3.5Z"
      />
      <path strokeLinecap="round" d="M8 15.5h4" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 10.5 3 3 7-7" />
    </svg>
  );
}

export const ReceiveQueueRow = memo(function ReceiveQueueRow({
  order,
  groupIndex,
  rowIndex,
  isInfo,
  isFirstInProductGroup,
  productGroupIds,
  productGroupAllSelected,
  selected,
  pending,
  inputVal,
  searchQuery = null,
  onToggleSelected,
  onQtyChange,
  onSaveDelivery,
  onFillFullQty,
  onNotifyInformacja,
  onToggleProductGroup,
  onAckCancelDisposition,
  rowRef,
  dataIndex,
}: {
  order: IndividualOrder;
  groupIndex: number;
  rowIndex: number;
  isInfo: boolean;
  isFirstInProductGroup: boolean;
  productGroupIds: string[];
  productGroupAllSelected: boolean;
  selected: boolean;
  pending: boolean;
  inputVal: string;
  searchQuery?: string | null;
  onToggleSelected: () => void;
  onQtyChange: (value: string) => void;
  onSaveDelivery: () => void;
  onFillFullQty: () => void;
  onNotifyInformacja: (ids: string[]) => void;
  onToggleProductGroup: (checked: boolean) => void;
  onAckCancelDisposition: () => void;
  rowRef?: (element: Element | null) => void;
  dataIndex?: number;
}) {
  const personName = order.sales_person?.name?.trim() || "—";
  const fulfillment = fulfillmentProgressFor(order);
  const targetQty = receiveQueueTargetQuantity(order);
  const ordered = targetQty ?? parseOrderQuantity(order.quantity);
  const previewN = inputVal === "" ? 0 : parseInt(inputVal, 10);
  const progress = getDeliveryProgress(
    ordered != null ? String(ordered) : order.quantity,
    Number.isFinite(previewN) ? String(previewN) : "0"
  );
  const isPartial = !isInfo && order.status === "Czesciowo_zrealizowane";
  const salesCancelRow = Boolean(order.sales_cancelled_at);
  const cancelDisposition = isCancelledDispositionInReceiveQueue(order);
  const needsReceiveForCancel = needsReceiveBeforeWarehouseCancelAck(order);
  const canAckCancel = canAcknowledgeWarehouseCancelDisposition(order);
  const cancelAckLabel = warehouseCancelFulfillButtonLabel(order);
  const partialCross = partialReceiveCrossLabel(order);
  const zakupyLabel = procurementDispositionQueueLabel(order);
  const canSave = !isInfo && inputVal.trim() !== "";
  const showProductGroupLink = isInfo && isFirstInProductGroup && productGroupIds.length > 1;
  const informacjaActionLabel = isInfo
    ? informacjaWarehouseQueueActionLabel(order.status)
    : null;
  const informacjaButtonLabel =
    isInfo && productGroupIds.length > 1 && isFirstInProductGroup
      ? `Powiadom (${productGroupIds.length})`
      : isInfo && order.status === "Nowe"
        ? "Wyślij e-mail"
        : isInfo
          ? "Powiadom"
          : null;

  const onQtyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSave) {
      e.preventDefault();
      onSaveDelivery();
    }
  };

  return (
    <tr
      ref={rowRef}
      data-index={dataIndex}
      className={cn(
        queueSupplierRowClass(groupIndex, {
          variant: "delivery",
          isPartial,
          isFirstInSupplierGroup: rowIndex === 0,
        }),
        isInfo && "bg-sky-50/40",
        salesCancelRow && "bg-amber-50/50",
        selected && "ring-1 ring-inset ring-violet-300/80"
      )}
    >
      <td
        className={cn(
          "w-10 text-center",
          queueSupplierLeadingCellClass(groupIndex, {
            variant: isInfo ? "informacja" : "delivery",
          })
        )}
      >
        <input
          type="checkbox"
          className={cn("size-4", checkboxBrandClass)}
          checked={selected}
          disabled={pending}
          aria-label={`Zaznacz ${personName}`}
          onChange={onToggleSelected}
        />
      </td>

      <td className="min-w-[6rem] max-w-[8rem] whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              isInfo ? "bg-sky-500" : "bg-emerald-500"
            )}
            title={isInfo ? "Informacja" : "Zamówienie"}
          />
          <span className="truncate font-semibold text-slate-900" title={personName}>
            {personName}
          </span>
        </div>
        {(salesCancelRow || isPartial) && (
          <p className="mt-0.5 pl-3 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            {salesCancelRow
              ? fulfillment.cancelled > 0 && (fulfillment.supplierRemaining ?? 0) > 0
                ? `częściowa · ${fulfillment.supplierRemaining} szt.`
                : "rezygnacja"
              : "częściowo"}
          </p>
        )}
      </td>

      <td className="min-w-0 max-w-[1px] w-full">
        {isInfo && !isFirstInProductGroup ? (
          <p className="truncate pl-3 text-xs text-slate-500">↳ ten sam towar</p>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <SearchHighlightText
                text={order.products}
                searchQuery={searchQuery}
                className="truncate font-medium text-slate-800"
                as="p"
              />
              {order.is_teeth ? (
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  Zęby
                </span>
              ) : null}
            </div>
            {order.symbol && order.symbol !== "-" ? (
              <SearchHighlightText
                text={order.symbol}
                searchQuery={searchQuery}
                className="truncate text-[11px] text-slate-500"
                as="p"
              />
            ) : null}
            {showProductGroupLink ? (
              <button
                type="button"
                className="mt-0.5 text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
                disabled={pending}
                onClick={() => onToggleProductGroup(!productGroupAllSelected)}
              >
                {productGroupAllSelected
                  ? "Odznacz ten towar"
                  : `Zaznacz ${productGroupIds.length} informacji`}
              </button>
            ) : null}
            {!isInfo && partialCross ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-amber-800">
                {partialCross}
              </p>
            ) : null}
            {!isInfo && zakupyLabel ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-emerald-900">
                {zakupyLabel}
              </p>
            ) : null}
          </div>
        )}
      </td>

      <td className={cn("whitespace-nowrap text-right", cancelDisposition ? "min-w-[10rem]" : "min-w-[9.5rem]")}>
        {isInfo ? (
          <button
            type="button"
            disabled={pending}
            title={
              productGroupIds.length > 1 && isFirstInProductGroup
                ? `Powiadom ${productGroupIds.length} handlowców o tym towarze`
                : informacjaActionLabel ?? "Powiadom handlowca"
            }
            aria-label={
              productGroupIds.length > 1 && isFirstInProductGroup
                ? `Powiadom ${productGroupIds.length} handlowców`
                : informacjaActionLabel ?? `Powiadom ${personName}`
            }
            onClick={() =>
              onNotifyInformacja(
                productGroupIds.length > 1 && isFirstInProductGroup
                  ? productGroupIds
                  : [order.id]
              )
            }
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
              "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300 hover:bg-sky-100",
              "disabled:opacity-50"
            )}
          >
            <NotifyIcon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{informacjaButtonLabel}</span>
          </button>
        ) : cancelDisposition ? (
          <div className="flex flex-col items-end gap-1.5">
            {needsReceiveForCancel ? (
              <div className="inline-flex items-center justify-end gap-1 tabular-nums">
                <button
                  type="button"
                  disabled={pending || ordered == null}
                  title="Przyjmij całą ilość z rezygnacji"
                  onClick={onFillFullQty}
                  className={cn(
                    "min-w-[1.75rem] rounded px-1 py-0.5 text-sm font-medium text-slate-600",
                    ordered != null && "hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {ordered ?? order.quantity}
                </button>
                <span className="inline-flex items-center text-slate-300" aria-hidden>
                  <FlowChevron size={12} />
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={pending}
                  value={inputVal}
                  onChange={(e) => onQtyChange(e.target.value)}
                  onKeyDown={onQtyKeyDown}
                  className={cn(
                    "w-14 rounded-md border border-slate-200 px-1 py-1 text-center text-sm font-semibold sm:w-12",
                    controlFocusClass
                  )}
                  aria-label={`Przyjęto z rezygnacji dla ${personName}`}
                />
                <button
                  type="button"
                  disabled={pending || !canSave}
                  title="Zapisz przyjęcie (Enter)"
                  aria-label="Zapisz przyjęcie"
                  onClick={onSaveDelivery}
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-lg border transition sm:size-8",
                    canSave
                      ? "border-violet-200 bg-violet-600 text-white hover:bg-violet-700"
                      : "border-slate-200 bg-slate-50 text-slate-300"
                  )}
                >
                  <SaveIcon className="size-4" />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              disabled={pending || !canAckCancel}
              title={
                needsReceiveForCancel
                  ? "Najpierw przyjmij towar, gdy dotrze od dostawcy"
                  : cancelAckLabel
              }
              onClick={onAckCancelDisposition}
              className={cn(
                "inline-flex max-w-full items-center justify-center rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-tight transition",
                canAckCancel
                  ? "border-amber-300 bg-amber-100 text-amber-950 hover:border-amber-400 hover:bg-amber-200"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              )}
            >
              {cancelAckLabel}
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center justify-end gap-1 tabular-nums">
            <button
              type="button"
              disabled={pending || ordered == null}
              title="Przyjmij całą zamówioną ilość"
              onClick={onFillFullQty}
              className={cn(
                "min-w-[1.75rem] rounded px-1 py-0.5 text-sm font-medium text-slate-600",
                ordered != null && "hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {ordered ?? order.quantity}
            </button>
            <span className="inline-flex items-center text-slate-300" aria-hidden>
              <FlowChevron size={12} />
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              disabled={pending}
              value={inputVal}
              onChange={(e) => onQtyChange(e.target.value)}
              onKeyDown={onQtyKeyDown}
              className={cn(
                "w-14 rounded-md border border-slate-200 px-1 py-1 text-center text-sm font-semibold sm:w-12",
                controlFocusClass
              )}
              aria-label={`Dostarczono dla ${personName}`}
            />
            {progress.hasNumericQty ? (
              <span
                className={cn(
                  "min-w-[1.25rem] text-[11px] font-bold",
                  progress.remaining && progress.remaining > 0
                    ? "text-amber-700"
                    : "text-emerald-700"
                )}
                title="Brakuje"
              >
                {progress.remaining === 0 ? (
                  <InlineCheck size={13} />
                ) : (
                  `−${progress.remaining}`
                )}
              </span>
            ) : null}
            <button
              type="button"
              disabled={pending || !canSave}
              title="Zapisz (Enter)"
              aria-label="Zapisz dostawę"
              onClick={onSaveDelivery}
              className={cn(
                "ml-0.5 inline-flex size-10 items-center justify-center rounded-lg border transition sm:size-8",
                canSave
                  ? "border-violet-200 bg-violet-600 text-white hover:bg-violet-700"
                  : "border-slate-200 bg-slate-50 text-slate-300"
              )}
            >
              <SaveIcon className="size-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});
