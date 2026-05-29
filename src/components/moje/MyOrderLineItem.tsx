"use client";

import type { MyOrderLine, MyOrderLineStockStatus } from "@/lib/orders/my-order-presenter";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { SalesClientNameEditor } from "@/components/moje/SalesClientNameEditor";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { cn } from "@/lib/cn";

function stockBadge(status: MyOrderLineStockStatus): { label: string; className: string } | null {
  switch (status) {
    case "on_stock":
      return {
        label: "U nas",
        className: "bg-emerald-100 text-emerald-800",
      };
    case "partial":
      return {
        label: "Częściowo",
        className: "bg-amber-100 text-amber-900",
      };
    case "waiting":
      return {
        label: "W dostawie",
        className: "bg-slate-100 text-slate-600",
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
  hideClientLabel = false,
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
  /** Gdy klient jest już w MetaGrid (1 produkt w grupie). */
  hideClientLabel?: boolean;
}) {
  const badge = showProgress && emphasizeStock ? stockBadge(line.stockStatus) : null;
  const onStock = line.stockStatus === "on_stock";
  const partial = line.stockStatus === "partial";

  const detail = [line.symbol, line.quantityLabel, showProgress ? line.progressLabel : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cn(
        compact ? "py-1 first:pt-0" : "py-1.5 px-0.5",
        emphasizeStock && onStock && "border-l-2 border-emerald-500 pl-2",
        emphasizeStock && partial && "border-l-2 border-amber-400 pl-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800">
            {!compact ? (
              <span className="mr-1.5 tabular-nums text-slate-400">{index + 1}.</span>
            ) : null}
            {line.product}
          </p>
          {detail ? (
            <p
              className={cn(
                "mt-0.5 text-xs",
                compact ? "text-slate-500" : "pl-5 text-slate-500",
                emphasizeStock && onStock && "font-medium text-emerald-800",
                emphasizeStock && partial && "font-medium text-amber-900"
              )}
            >
              {detail}
            </p>
          ) : null}
          {canEditClient && onSaveClient && openClientEditor ? (
            <SalesClientNameEditor
              value={line.clientName}
              disabled={pending}
              openOnMount
              onSave={(name) => onSaveClient(line.id, name)}
            />
          ) : !hideClientLabel && line.clientName?.trim() ? (
            <MyOrderAssignedClient
              name={line.clientName}
              className={cn("mt-0.5", !compact && "pl-5")}
            />
          ) : null}
        </div>
        {badge ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              badge.className
            )}
          >
            {onStock ? "✓ " : ""}
            {badge.label}
          </span>
        ) : null}
      </div>
      {canAcknowledge && line.canAcknowledgePickup && onAcknowledgePickup ? (
        <MyOrderAckButton
          variant="inline"
          className="mt-1.5"
          disabled={pending}
          title={acknowledgeLineTitle}
          onClick={() => onAcknowledgePickup(line.id)}
        >
          {acknowledgeLineLabel}
        </MyOrderAckButton>
      ) : null}
    </li>
  );
}
