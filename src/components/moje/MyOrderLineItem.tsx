"use client";

import { memo, useCallback, useState } from "react";
import { zdFulfillmentDeadlineChangeShortLabel } from "@/lib/orders/zd-fulfillment-deadline-change";
import { parseDateOnly } from "@/lib/orders/dates";
import { isPastExpectedDate } from "@/lib/orders/delivery-eta";
import {
  formatMyOrderHistoryEstimateLineLabel,
} from "@/lib/orders/my-order-history-estimate-copy";
import {
  ZD_ETA_LINE_NO_MATCH_LABEL,
  ZD_ETA_LINE_PENDING_LABEL,
} from "@/lib/orders/my-order-zd-eta-copy";
import { salesZdTimingLabel } from "@/lib/orders/my-order-sales-ui";
import { resolveExpandedLineQuantityDisplay } from "@/lib/orders/my-order-line-quantity-display";
import type { MyOrderLine, MyOrderLineStockStatus } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderRequestNote } from "@/components/moje/MyOrderRequestNote";
import { MyOrderProcurementCancelNote } from "@/components/moje/MyOrderProcurementCancelNote";
import { MyOrderLineClientField } from "@/components/moje/MyOrderLineClientField";
import { MyOrderLineActionBar } from "@/components/moje/MyOrderLineActionBar";
import { MyOrderLineCancelMenu } from "@/components/moje/MyOrderLineCancelMenu";
import { TeethOrderDetailDialog } from "@/components/moje/TeethOrderDetailDialog";
import { TeethGroupChips } from "@/components/teeth/TeethGroupChips";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import type { SalesClientAssignment } from "@/lib/orders/sales-client-label";
import { cn } from "@/lib/cn";
import {
  mojeActionOverflowSegmentClass,
  panelSegmentLastClass,
} from "@/lib/ui/ontime-theme";
import {
  mojeShipmentLineActionColumnClass,
  mojeShipmentLineRowClass,
} from "@/lib/ui/moje-shipment-row-styles";
import {
  SearchHighlightJoined,
  SearchHighlightText,
} from "@/components/moje/SearchHighlightText";

function CopyBadge({
  text,
  copyValue,
  title,
  className,
  searchQuery,
}: {
  text: string;
  copyValue: string;
  title: string;
  className: string;
  searchQuery?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }, [copyValue]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? "Skopiowano!" : `${title} — kliknij, aby skopiować`}
      className={cn(
        "shrink-0 cursor-pointer rounded px-1 py-0.5 font-mono text-[10px] font-semibold transition-colors",
        className,
        copied && "ring-2 ring-emerald-400"
      )}
    >
      <SearchHighlightText text={copied ? "✓ skopiowano" : text} searchQuery={searchQuery} />
    </button>
  );
}

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

export const MyOrderLineItem = memo(function MyOrderLineItem({
  line,
  index,
  showProgress,
  emphasizeStock,
  compact = false,
  canAcknowledge,
  pending,
  acknowledgeLineLabel = "Potwierdź tę pozycję",
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
  hideZdLineDetail = false,
  hideWarehouseProgress = false,
  lineActionColumn = false,
  informacjaAck = false,
  tourPreview = false,
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
      teethDetails?: import("@/lib/teeth/teeth-catalog").TeethLineDetail[];
      teethLineDelivered?: Record<string, number> | null;
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
  /** Gdy termin ZD jest już w sekcji „Informacje o dostawie” grupy. */
  hideZdLineDetail?: boolean;
  /** Magazyn grupy w „Szczegółach” — ukryj postęp magazynowy per pozycja. */
  hideWarehouseProgress?: boolean;
  /** Wyrównana kolumna akcji (rozwinięta lista z potwierdzeniami per pozycja). */
  lineActionColumn?: boolean;
  informacjaAck?: boolean;
  tourPreview?: boolean;
  searchQuery?: string | null;
  listKind?: "zamowienie" | "informacja";
  /** Szacunek z historii grupy — gdy linia czeka na ZD lub nie ma terminu w ZD u dostawcy. */
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
        : ZD_ETA_LINE_PENDING_LABEL
      : line.zdEtaNoMatch
        ? historyLabel
          ? formatMyOrderHistoryEstimateLineLabel(historyLabel, {
              lowConfidence: historyLowConfidence,
            })
          : ZD_ETA_LINE_NO_MATCH_LABEL
        : null;

  const { quantityLabel: lineQuantityLabel, progressInDetail } =
    resolveExpandedLineQuantityDisplay(line, {
      compact,
      showProgress,
      hideWarehouseProgress,
    });

  const detailParts = [
    progressInDetail,
    hideZdLineDetail ? null : zdLineDetail,
  ].filter(Boolean);

  const partialDefaultQty = line.defaultSalesCancelQuantity;
  const partialMaxQty = line.maxSalesCancelQuantity ?? partialDefaultQty ?? 1;

  const showRemainderCancel =
    Boolean(line.showSalesCancelRemainder && partialDefaultQty != null && onPartialCancelLine);
  const showSupplierQuickCancel =
    !showRemainderCancel && Boolean(line.showSalesCancelSupplierQuick && onPartialCancelLine);
  const showPartialQtyCancel = Boolean(line.canPartialSalesCancel && onPartialCancelLine);
  const showFullLineCancel =
    Boolean(onCancelLine) && !showRemainderCancel && !showSupplierQuickCancel;

  const showLinePickupAck =
    canAcknowledge && line.canAcknowledgePickup && onAcknowledgePickup;
  const showCancelActions = Boolean(
    canCancelLine &&
      line.canCancelBySales &&
      line.salesCancelPhase &&
      (onCancelLine || onPartialCancelLine)
  );
  const showTeethDetail = Boolean(line.teethDetails && line.teethDetails.length > 0);

  const partialCustomDefaultQty =
    showRemainderCancel || showSupplierQuickCancel
      ? 1
      : line.salesCancelPhase === "in_transit"
        ? 1
        : partialDefaultQty ?? 1;

  const runPartialCancel = (defaultQty: number) => {
    if (!onPartialCancelLine || !line.salesCancelPhase) return;
    onPartialCancelLine(line.id, line.salesCancelPhase, {
      product: line.product,
      maxQty: partialMaxQty,
      defaultQty,
      deliveredQty: line.salesCancelDeliveredQty,
      teethDetails: line.teethDetails,
      teethLineDelivered: line.teethLineDelivered,
    });
  };

  const lineCancelMenu = showCancelActions ? (
    <MyOrderLineCancelMenu
      product={line.product}
      listKind={listKind}
      pending={pending}
      showRemainderCancel={showRemainderCancel}
      partialDefaultQty={partialDefaultQty}
      showSupplierQuickCancel={showSupplierQuickCancel}
      showPartialQtyCancel={showPartialQtyCancel}
      showFullLineCancel={showFullLineCancel}
      partialCustomDefaultQty={partialCustomDefaultQty}
      cancelLineLabel={cancelLineLabel}
      cancelLineAriaLabel={cancelLineAriaLabel}
      onRunPartialCancel={runPartialCancel}
      onCancelLine={
        showFullLineCancel && onCancelLine && line.salesCancelPhase
          ? () => onCancelLine(line.id, line.salesCancelPhase!)
          : undefined
      }
      variant={showLinePickupAck && showCancelActions ? "segment" : "standalone"}
      className={
        showLinePickupAck && showCancelActions
          ? cn(mojeActionOverflowSegmentClass, panelSegmentLastClass)
          : undefined
      }
    />
  ) : null;

  const lineActionBar = (
    <MyOrderLineActionBar
      showPickup={Boolean(showLinePickupAck)}
      pickupLabel={
        showLinePickupAck && showCancelActions ? "Potwierdź" : acknowledgeLineLabel
      }
      pickupTitle={acknowledgeLineTitle}
      onPickup={
        showLinePickupAck && onAcknowledgePickup
          ? () => onAcknowledgePickup(line.id)
          : undefined
      }
      pending={pending}
      preview={tourPreview}
      informacjaAck={informacjaAck}
      cancelMenu={lineCancelMenu}
    />
  );

  const showLineActionBar = showLinePickupAck || lineCancelMenu;
  /** ⋮ bez „Potwierdź” — w nagłówku pozycji, nie na środku wiersza. */
  const inlineLineActionBar =
    compact && showLineActionBar && !showLinePickupAck;
  const showActionInColumn = showLineActionBar && !inlineLineActionBar;

  const teethDetailBlock = showTeethDetail ? (
    <TeethOrderDetailDialog
      teethDetails={line.teethDetails!}
      teethLineDelivered={line.teethLineDelivered}
      deliveredQuantity={line.deliveredQuantity}
      triggerSize="sm"
      triggerVariant="ghost"
      triggerClassName="text-[10px] font-medium text-indigo-700 hover:text-indigo-900"
    />
  ) : null;
  const showTeethDetailInline = false;

  const lineSideMeta =
    badge ? (
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
  ) : null;

  const hasRightColumn = showActionInColumn;
  const useActionColumn = lineActionColumn && hasRightColumn;

  return (
    <li
      className={cn(
        "group/line",
        compact ? mojeShipmentLineRowClass : "py-1.5 px-0.5",
        compact && useActionColumn && showLinePickupAck && "bg-emerald-50/20",
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
      <div
        className={cn(
          "flex gap-2.5",
          useActionColumn ? "flex-col sm:flex-row sm:items-start sm:gap-3" : "items-start justify-between sm:gap-3"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
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
                "min-w-0 font-semibold text-slate-900",
                compact ? "text-sm leading-snug" : "text-sm text-slate-800"
              )}
            />
            {lineQuantityLabel ? (
              <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-500">
                {lineQuantityLabel}
              </span>
            ) : null}
            {line.symbol?.trim() && !(line.teethDetails && line.teethDetails.length > 0) ? (
              <CopyBadge
                text={line.symbol.trim()}
                copyValue={line.symbol.trim()}
                title="Symbol"
                className="bg-slate-100 text-slate-600"
                searchQuery={searchQuery}
              />
            ) : null}
            {line.mikranCode?.trim() && !(line.teethDetails && line.teethDetails.length > 0) ? (
              <CopyBadge
                text={`PLU ${line.mikranCode.trim()}`}
                copyValue={line.mikranCode.trim()}
                title="Kod Mikran (PLU)"
                className="bg-violet-50 text-violet-800 ring-1 ring-violet-200/80"
                searchQuery={searchQuery}
              />
            ) : null}
            </div>
          </div>

          {(detailParts.length > 0 || lineSideMeta) ? (
            <div
              className={cn(
                "mt-0.5 flex flex-wrap items-center gap-1.5",
                !compact && "pl-5"
              )}
            >
              {lineSideMeta}
              {detailParts.length > 0 ? (
                <p
                  className={cn(
                    "text-[11px] leading-relaxed text-slate-500",
                    emphasizeStock && onStock && "font-medium text-emerald-800",
                    emphasizeStock && partial && "font-medium text-sky-900"
                  )}
                >
                  <SearchHighlightJoined parts={detailParts} searchQuery={searchQuery} />
                </p>
              ) : null}
            </div>
          ) : null}

          {line.teethDetails && line.teethDetails.length > 0 ? (
            <div className={cn("mt-1.5", !compact && "pl-5")}>
              <TeethGroupChips details={line.teethDetails} variant="prosba" compact />
            </div>
          ) : null}

          {canEditClient && onSaveClient && onStartEditClient ? (
            <MyOrderLineClientField
              clientName={line.clientName}
              clientKhId={line.clientKhId}
              disabled={pending}
              editing={openClientEditor}
              className={cn("mt-2 border-t border-slate-100 pt-2", !compact && "pl-5")}
              onStartEdit={onStartEditClient}
              onSave={(patch) => onSaveClient(line.id, patch)}
            />
          ) : !hideClientLabel && line.clientName?.trim() ? (
            <MyOrderAssignedClient
              name={line.clientName}
              searchQuery={searchQuery}
              className={cn("mt-2 border-t border-slate-100 pt-2", !compact && "pl-5")}
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

        {inlineLineActionBar ? (
          <div className="flex shrink-0 items-center gap-1.5 self-center">
            {showTeethDetail ? teethDetailBlock : null}
            {lineActionBar}
          </div>
        ) : null}

        {useActionColumn ? (
          <div className={mojeShipmentLineActionColumnClass}>
            {showActionInColumn ? lineActionBar : null}
          </div>
        ) : hasRightColumn ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5 self-start">
            {showActionInColumn ? lineActionBar : null}
          </div>
        ) : null}
      </div>
    </li>
  );
});
