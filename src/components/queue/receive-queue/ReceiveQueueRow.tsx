"use client";

import type { KeyboardEvent } from "react";
import type { IndividualOrder } from "@/types/database";
import { FlowChevron, InlineCheck } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { checkboxBrandClass, controlFocusClass } from "@/lib/ui/ontime-theme";
import { getDeliveryProgress, parseOrderQuantity } from "@/lib/orders/individual";
import { procurementDispositionQueueLabel } from "@/lib/orders/procurement-disposition";
import { partialReceiveCrossLabel } from "@/lib/orders/warehouse-cross-link";
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

export function ReceiveQueueRow({
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
  onToggleSelected,
  onQtyChange,
  onSaveDelivery,
  onFillFullQty,
  onNotifyInformacja,
  onToggleProductGroup,
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
  onToggleSelected: () => void;
  onQtyChange: (value: string) => void;
  onSaveDelivery: () => void;
  onFillFullQty: () => void;
  onNotifyInformacja: (ids: string[]) => void;
  onToggleProductGroup: (checked: boolean) => void;
}) {
  const personName = order.sales_person?.name?.trim() || "—";
  const ordered = parseOrderQuantity(order.quantity);
  const previewN = inputVal === "" ? 0 : parseInt(inputVal, 10);
  const progress = getDeliveryProgress(
    order.quantity,
    Number.isFinite(previewN) ? String(previewN) : "0"
  );
  const isPartial = !isInfo && order.status === "Czesciowo_zrealizowane";
  const salesCancelRow = Boolean(order.sales_cancelled_at);
  const partialCross = partialReceiveCrossLabel(order);
  const zakupyLabel = procurementDispositionQueueLabel(order);
  const productTitle = [order.products, order.symbol && order.symbol !== "-" ? order.symbol : null]
    .filter(Boolean)
    .join(" · ");
  const canSave = !isInfo && inputVal.trim() !== "";
  const showProductGroupLink = isInfo && isFirstInProductGroup && productGroupIds.length > 1;

  const onQtyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSave) {
      e.preventDefault();
      onSaveDelivery();
    }
  };

  return (
    <tr
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
          "w-9 text-center",
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

      <td className="min-w-[7rem] max-w-[9rem] whitespace-nowrap">
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
            {salesCancelRow ? "rezygnacja" : "częściowo"}
          </p>
        )}
      </td>

      <td className="min-w-0 max-w-[1px] w-full">
        {isInfo && !isFirstInProductGroup ? (
          <p className="truncate pl-3 text-xs text-slate-500">↳ ten sam towar</p>
        ) : (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800" title={productTitle}>
              {order.products}
            </p>
            {order.symbol && order.symbol !== "-" ? (
              <p className="truncate text-[11px] text-slate-500">{order.symbol}</p>
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

      <td className="w-[9.5rem] whitespace-nowrap text-right">
        {isInfo ? (
          <button
            type="button"
            disabled={pending}
            title={
              productGroupIds.length > 1 && isFirstInProductGroup
                ? `Powiadom ${productGroupIds.length} handlowców o tym towarze`
                : "Powiadom handlowca"
            }
            aria-label={
              productGroupIds.length > 1 && isFirstInProductGroup
                ? `Powiadom ${productGroupIds.length} handlowców`
                : `Powiadom ${personName}`
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
            <span className="hidden sm:inline">
              {productGroupIds.length > 1 && isFirstInProductGroup
                ? `Powiadom (${productGroupIds.length})`
                : "Powiadom"}
            </span>
          </button>
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
                "w-11 rounded-md border border-slate-200 px-1 py-1 text-center text-sm font-semibold",
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
                "ml-0.5 inline-flex size-8 items-center justify-center rounded-lg border transition",
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
}
