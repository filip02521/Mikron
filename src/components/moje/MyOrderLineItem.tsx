"use client";

import type { MyOrderLine, MyOrderLineStockStatus } from "@/lib/orders/my-order-presenter";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { MyOrderLineClientField } from "@/components/moje/MyOrderLineClientField";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
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
  canEditClient,
  onSaveClient,
  openClientEditor = false,
  onStartEditClient,
  hideClientLabel = false,
  searchQuery,
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
  canEditClient?: boolean;
  onSaveClient?: (orderId: string, name: string | null) => void | Promise<void>;
  openClientEditor?: boolean;
  onStartEditClient?: () => void;
  /** Gdy klient jest już w MetaGrid (1 produkt, bez edycji). */
  hideClientLabel?: boolean;
  searchQuery?: string | null;
}) {
  const badge = showProgress && emphasizeStock ? stockBadge(line.stockStatus) : null;
  const onStock = line.stockStatus === "on_stock";
  const partial = line.stockStatus === "partial";

  const detailParts = [line.quantityLabel, showProgress ? line.progressLabel : null].filter(
    Boolean
  );

  return (
    <li
      className={cn(
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
              disabled={pending}
              editing={openClientEditor}
              className={cn("mt-1.5", !compact && "pl-5")}
              onStartEdit={onStartEditClient}
              onSave={(name) => onSaveClient(line.id, name)}
            />
          ) : !hideClientLabel && line.clientName?.trim() ? (
            <MyOrderAssignedClient
              name={line.clientName}
              searchQuery={searchQuery}
              className={cn("mt-1.5", !compact && "pl-5")}
            />
          ) : null}
        </div>

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
