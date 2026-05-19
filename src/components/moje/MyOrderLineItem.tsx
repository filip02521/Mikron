"use client";

import type { MyOrderLine, MyOrderLineStockStatus } from "@/lib/orders/my-order-presenter";
import { SalesClientNameEditor } from "@/components/moje/SalesClientNameEditor";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function stockBadge(status: MyOrderLineStockStatus): { label: string; className: string } | null {
  switch (status) {
    case "on_stock":
      return {
        label: "U nas",
        className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
      };
    case "partial":
      return {
        label: "Częściowo",
        className: "bg-amber-100 text-amber-900 ring-amber-200",
      };
    case "waiting":
      return {
        label: "W dostawie",
        className: "bg-slate-100 text-slate-600 ring-slate-200",
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
  canAcknowledge,
  pending,
  onAcknowledgePickup,
  canEditClient,
  onSaveClient,
}: {
  line: MyOrderLine;
  index: number;
  showProgress: boolean;
  emphasizeStock: boolean;
  canAcknowledge: boolean;
  pending: boolean;
  onAcknowledgePickup?: (orderId: string) => void;
  canEditClient?: boolean;
  onSaveClient?: (orderId: string, name: string | null) => void | Promise<void>;
}) {
  const badge = showProgress && emphasizeStock ? stockBadge(line.stockStatus) : null;
  const onStock = line.stockStatus === "on_stock";
  const partial = line.stockStatus === "partial";
  const waiting = line.stockStatus === "waiting";

  return (
    <li
      className={cn(
        "rounded-lg border px-2.5 py-2 transition-colors",
        emphasizeStock &&
          onStock &&
          "border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-300/80",
        emphasizeStock &&
          partial &&
          "border-amber-300 bg-amber-50 ring-1 ring-amber-200/70",
        emphasizeStock && waiting && "border-dashed border-slate-200 bg-white/60 opacity-75",
        !emphasizeStock && "border-slate-200/80 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-slate-800">
          <span className="mr-1.5 tabular-nums text-slate-400">{index + 1}.</span>
          {line.product}
        </p>
        {badge ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
              badge.className
            )}
          >
            {onStock ? "✓ " : ""}
            {badge.label}
          </span>
        ) : null}
      </div>
      {canEditClient && onSaveClient ? (
        <SalesClientNameEditor
          value={line.clientName}
          disabled={pending}
          onSave={(name) => onSaveClient(line.id, name)}
        />
      ) : line.clientName ? (
        <p className="mt-1 pl-5 text-xs text-slate-600">
          <span className="text-slate-400">Klient:</span>{" "}
          <span className="font-medium">{line.clientName}</span>
        </p>
      ) : null}
      <p
        className={cn(
          "mt-0.5 pl-5 text-xs",
          emphasizeStock && onStock && "font-medium text-emerald-900",
          emphasizeStock && partial && "font-medium text-amber-900",
          !emphasizeStock || waiting ? "text-slate-500" : ""
        )}
      >
        {[line.symbol, line.quantityLabel, showProgress ? line.progressLabel : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {canAcknowledge && line.canAcknowledgePickup && onAcknowledgePickup ? (
        <Button
          size="lg"
          variant="secondary"
          className="mt-2.5 w-full min-h-11 sm:w-auto sm:min-h-9 sm:py-2 sm:text-xs"
          disabled={pending}
          onClick={() => onAcknowledgePickup(line.id)}
        >
          Potwierdzam odbiór tej pozycji
        </Button>
      ) : null}
    </li>
  );
}
