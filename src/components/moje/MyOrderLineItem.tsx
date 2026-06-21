"use client";

import { zdFulfillmentDeadlineChangeShortLabel } from "@/components/orders/ZdFulfillmentDeadlineChangeNotice";
import { formatPlDate } from "@/lib/display-labels";
import { parseDateOnly } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import { formatMyOrderHistoryEstimateLineLabel } from "@/lib/orders/my-order-history-estimate-copy";
import { salesZdTimingLabel } from "@/lib/orders/my-order-sales-ui";
import type { MyOrderLine, MyOrderLineStockStatus } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import {
  salesCancelLineCustomQtyLabel,
  salesCancelLineRemainderLabel,
  salesCancelLineRemainderAriaLabel,
  salesCancelLineShortLabel,
  salesCancelQuickActionLabel,
} from "@/lib/orders/sales-cancel";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderRequestNote } from "@/components/moje/MyOrderRequestNote";
import { MyOrderProcurementCancelNote } from "@/components/moje/MyOrderProcurementCancelNote";
import { MyOrderLineClientField } from "@/components/moje/MyOrderLineClientField";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { MyOrderCancelButton } from "@/components/moje/MyOrderCancelButton";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import type { SalesClientAssignment } from "@/lib/orders/sales-client-label";
import { cn } from "@/lib/cn";
import { mojeShipmentLineRowClass } from "@/lib/ui/moje-shipment-row-styles";
import {
  SearchHighlightJoined,
  SearchHighlightText,
} from "@/components/moje/SearchHighlightText";

function stockBadge(status: MyOrderLineStockStatus): { label: string; className: string } | null {
  switch (status) {
    case "on_stock":
      return {
        label: "U nas",
        className: "bg-emerald-50 text-emerald-800 ring-emerald-200/90",
      };
    case "partial":
      return {
        label: "Częściowo",
        className: "bg-sky-50 text-sky-900 ring-sky-200/90",
      };
    case "waiting":
      return {
        label: "W dostawie",
        className: "bg-slate-50 text-slate-600 ring-slate-200/90",
      };
    default:
      return null;
  }
}

export function MyOrderLineItem({
  line,
  index,
  showProgress,
  emphasizeStock,
  compact = false,
  canAcknowledge,
  pending,
  acknowledgeLineLabel = "Potwierdź",
  acknowledgeLineTitle,
  onAcknowledgePickup,
  canCancelLine,
  cancelLineLabel = "Anuluj",
  cancelLineAriaLabel,
  onCancelLine,
  onPartialCancelLine,
  canEditClient,
  onSaveClient,
  openClientEditor = false,
  onStartEditClient,
  hideClientLabel = false,
  hideRequestNote = false,
  hideProcurementCancelNote = false,
  searchQuery,
  listKind = "zamowienie",
  historyEstimateLabel = null,
}: {
  line: MyOrderLine;
  index: number;
  showProgress: boolean;
  emphasizeStock: boolean;
  compact?: boolean;
  canAcknowledge?: boolean;
  pending?: boolean;
  acknowledgeLineLabel?: string;
  acknowledgeLineTitle?: string;
  onAcknowledgePickup?: (orderId: string) => void;
  canCancelLine?: boolean;
  cancelLineLabel?: string;
  cancelLineAriaLabel?: string;
  onCancelLine?: (orderId: string, phase: SalesCancelPhase) => void;
  onPartialCancelLine?: (
    orderId: string,
    phase: SalesCancelPhase,
    opts: {
      product: string;
      maxQty: number;
      defaultQty: number;
      deliveredQty?: number;
    }
  ) => void;
  canEditClient?: boolean;
  onSaveClient?: (orderId: string, patch: SalesClientAssignment) => void | Promise<void>;
  openClientEditor?: boolean;
  onStartEditClient?: () => void;
  /** Gdy klient jest już w MetaGrid (1 produkt, bez edycji). */
  hideClientLabel?: boolean;
  /** Gdy notatka jest już na karcie grupy — nie duplikuj przy produkcie. */
  hideRequestNote?: boolean;
  /** Gdy wiadomość od zakupów jest już na karcie grupy — nie duplikuj przy produkcie. */
  hideProcurementCancelNote?: boolean;
  searchQuery?: string | null;
  listKind?: "zamowienie" | "informacja";
  /** Szacunek z historii grupy — gdy linia czeka na ZD lub nie ma terminu w Subiekcie. */
  historyEstimateLabel?: string | null;
}) {
  const badge = showProgress && emphasizeStock ? stockBadge(line.stockStatus) : null;
  const onStock = line.stockStatus === "on_stock";
  const partial = line.stockStatus === "partial";

  const historyLabel = line.historyEstimateLabel ?? historyEstimateLabel;
  const historyLowConfidence =
    line.historyEstimateLowConfidence ?? /orientacyjnie/i.test(historyLabel ?? "");

  const zdLineDetail = line.zdFulfillment
    ? line.zdFulfillment.deadlineChange
      ? zdFulfillmentDeadlineChangeShortLabel(line.zdFulfillment.deadlineChange)
      : (() => {
          const deadline = line.zdFulfillment.deadline;
          const parsed = parseDateOnly(deadline);
          const overdue = parsed != null && isPastExpectedDate(parsed);
          return salesZdTimingLabel(deadline, line.zdFulfillment.dokNr, overdue);
        })()
    : line.zdEtaPending
      ? historyLabel
        ? formatMyOrderHistoryEstimateLineLabel(historyLabel, {
            lowConfidence: historyLowConfidence,
          })
        : "Sprawdzamy termin w Subiekcie…"
      : line.zdEtaNoMatch
        ? historyLabel
          ? formatMyOrderHistoryEstimateLineLabel(historyLabel, {
              lowConfidence: historyLowConfidence,
            })
          : "Brak terminu w Subiekcie"
        : null;

  const detailParts = [
    line.quantityLabel,
    showProgress ? line.progressLabel : null,
    zdLineDetail,
  ].filter(Boolean);

  const partialDefaultQty = line.defaultSalesCancelQuantity;
  const partialMaxQty = line.maxSalesCancelQuantity ?? partialDefaultQty ?? 1;
  const cancelButtonRevealClass =
    "opacity-70 transition-opacity group-hover/line:opacity-100 group-focus-within/line:opacity-100 focus-visible:opacity-100";

  const showRemainderCancel =
    Boolean(line.showSalesCancelRemainder && partialDefaultQty != null && onPartialCancelLine);
  const showSupplierQuickCancel =
    !showRemainderCancel && Boolean(line.showSalesCancelSupplierQuick && onPartialCancelLine);
  const showPartialQtyCancel = Boolean(line.canPartialSalesCancel && onPartialCancelLine);
  const showFullLineCancel =
    Boolean(onCancelLine) && !showRemainderCancel && !showSupplierQuickCancel;

  return (
    <li
      className={cn(
        "group/line",
        compact ? mojeShipmentLineRowClass : "py-1.5 px-0.5",
        !compact && emphasizeStock && onStock && "border-l-2 border-emerald-500 pl-2",
        !compact && emphasizeStock && partial && "border-l-2 border-sky-400 pl-2",
        compact &&
          emphasizeStock &&
          onStock &&
          "border-l-[3px] border-l-emerald-400 bg-emerald-50/20",
        compact &&
          emphasizeStock &&
          partial &&
          "border-l-[3px] border-l-sky-400 bg-sky-50/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              className={cn(
                "shrink-0 tabular-nums font-semibold text-slate-400",
                compact ? "text-xs" : "mr-1.5"
              )}
            >
              {index + 1}.
            </span>
            <SearchHighlightText
              text={line.product}
              searchQuery={searchQuery}
              className={cn(
                "min-w-0 font-medium text-slate-900",
                compact ? "text-xs leading-snug" : "text-sm text-slate-800"
              )}
            />
            {line.symbol?.trim() ? (
              <SearchHighlightText
                text={line.symbol.trim()}
                searchQuery={searchQuery}
                className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-slate-600"
              />
            ) : null}
            {line.mikranCode?.trim() ? (
              <span title="Kod Mikran (PLU)">
                <SearchHighlightText
                  text={`PLU ${line.mikranCode.trim()}`}
                  searchQuery={searchQuery}
                  className="shrink-0 rounded bg-violet-50 px-1 py-0.5 font-mono text-[10px] font-semibold text-violet-800 ring-1 ring-violet-200/80"
                />
              </span>
            ) : null}
          </div>

          {detailParts.length > 0 ? (
            <p
              className={cn(
                "mt-0.5 text-[11px] leading-relaxed text-slate-500",
                !compact && "pl-5",
                emphasizeStock && onStock && "font-medium text-emerald-800",
                emphasizeStock && partial && "font-medium text-sky-900"
              )}
            >
              <SearchHighlightJoined parts={detailParts} searchQuery={searchQuery} />
            </p>
          ) : null}

          {canEditClient && onSaveClient && onStartEditClient ? (
            <MyOrderLineClientField
              clientName={line.clientName}
              clientKhId={line.clientKhId}
              disabled={pending}
              editing={openClientEditor}
              className={cn("mt-1.5", !compact && "pl-5")}
              onStartEdit={onStartEditClient}
              onSave={(patch) => onSaveClient(line.id, patch)}
            />
          ) : !hideClientLabel && line.clientName?.trim() ? (
            <MyOrderAssignedClient
              name={line.clientName}
              searchQuery={searchQuery}
              className={cn("mt-1.5", !compact && "pl-5")}
            />
          ) : null}
          {!hideRequestNote && line.requestNote?.trim() ? (
            <MyOrderRequestNote
              note={line.requestNote}
              searchQuery={searchQuery}
              className={cn("mt-1.5", !compact && "pl-5")}
            />
          ) : null}
          {!hideProcurementCancelNote && line.procurementCancelNote?.trim() ? (
            <MyOrderProcurementCancelNote
              note={line.procurementCancelNote}
              searchQuery={searchQuery}
              className={cn("mt-1.5", !compact && "pl-5")}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {badge ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                badge.className
              )}
            >
              {onStock ? (
                <IconCircleCheck size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
              ) : null}
              {badge.label}
            </span>
          ) : null}
          {canCancelLine &&
          line.canCancelBySales &&
          line.salesCancelPhase &&
          (onCancelLine || onPartialCancelLine) ? (
            <div className="flex flex-col items-end gap-0.5">
              {showRemainderCancel ? (
                <MyOrderCancelButton
                  disabled={pending}
                  ariaLabel={salesCancelLineRemainderAriaLabel(partialDefaultQty!)}
                  onClick={() =>
                    onPartialCancelLine!(line.id, line.salesCancelPhase!, {
                      product: line.product,
                      maxQty: partialMaxQty,
                      defaultQty: partialDefaultQty!,
                      deliveredQty: line.salesCancelDeliveredQty,
                    })
                  }
                  className={cancelButtonRevealClass}
                >
                  {salesCancelLineRemainderLabel(partialDefaultQty!)}
                </MyOrderCancelButton>
              ) : null}
              {showSupplierQuickCancel ? (
                <MyOrderCancelButton
                  disabled={pending}
                  ariaLabel={salesCancelQuickActionLabel()}
                  onClick={() =>
                    onPartialCancelLine!(line.id, line.salesCancelPhase!, {
                      product: line.product,
                      maxQty: partialMaxQty,
                      defaultQty: 1,
                      deliveredQty: line.salesCancelDeliveredQty,
                    })
                  }
                  className={cancelButtonRevealClass}
                >
                  {salesCancelQuickActionLabel()}
                </MyOrderCancelButton>
              ) : null}
              {showPartialQtyCancel ? (
                <MyOrderCancelButton
                  disabled={pending}
                  ariaLabel={`${salesCancelLineCustomQtyLabel()} ${line.product}`}
                  onClick={() =>
                    onPartialCancelLine!(line.id, line.salesCancelPhase!, {
                      product: line.product,
                      maxQty: partialMaxQty,
                      defaultQty:
                        showRemainderCancel || showSupplierQuickCancel
                          ? 1
                          : line.salesCancelPhase === "in_transit"
                            ? 1
                            : partialDefaultQty ?? 1,
                      deliveredQty: line.salesCancelDeliveredQty,
                    })
                  }
                  className={cancelButtonRevealClass}
                >
                  {salesCancelLineCustomQtyLabel()}
                </MyOrderCancelButton>
              ) : null}
              {showFullLineCancel ? (
                <MyOrderCancelButton
                  disabled={pending}
                  ariaLabel={
                    cancelLineAriaLabel ??
                    `${salesCancelLineShortLabel(listKind)}: ${line.product}`
                  }
                  onClick={() => onCancelLine!(line.id, line.salesCancelPhase!)}
                  className={cancelButtonRevealClass}
                >
                  {cancelLineLabel ??
                    salesCancelLineShortLabel(listKind)}
                </MyOrderCancelButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {canAcknowledge && line.canAcknowledgePickup && onAcknowledgePickup ? (
        <MyOrderAckButton
          variant="inline"
          className="mt-2"
          disabled={pending}
          title={acknowledgeLineTitle}
          ariaLabel={acknowledgeLineTitle}
          onClick={() => onAcknowledgePickup(line.id)}
        >
          {acknowledgeLineLabel}
        </MyOrderAckButton>
      ) : null}
    </li>
  );
}
