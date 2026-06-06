"use client";

import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import { ProductSourceBadge } from "@/components/orders/ProductSourceBadge";
import { InformacjaFlowLineBadge } from "@/components/orders/InformacjaFlowLineBadge";
import { MyOrderAssignedClient } from "@/components/moje/MyOrderAssignedClient";
import { cn } from "@/lib/cn";

export function ProcurementRequestLine({
  line,
  className,
}: {
  line: ForSomeoneLine;
  className?: string;
}) {
  const hasMeta =
    (line.symbol && line.symbol !== "-") || (line.quantity && line.quantity !== "-");

  return (
    <li
      className={cn(
        "rounded-md border border-slate-100/80 bg-slate-50/50 px-2 py-1.5 text-xs",
        className
      )}
    >
      <ProcurementRequestLineContent line={line} />
    </li>
  );
}

/** Jedna pozycja inline w nagłówku grupy (bez osobnej listy). */
export function ProcurementRequestLineInline({
  line,
  className,
}: {
  line: ForSomeoneLine;
  className?: string;
}) {
  return (
    <div className={cn("mt-1", className)}>
      <ProcurementRequestLineContent line={line} compact />
    </div>
  );
}

function ProcurementRequestLineContent({
  line,
  compact = false,
}: {
  line: ForSomeoneLine;
  compact?: boolean;
}) {
  const hasMeta =
    (line.symbol && line.symbol !== "-") || (line.quantity && line.quantity !== "-");

  return (
    <>
      <p
        className={cn(
          "flex items-start gap-1.5 font-medium text-slate-900",
          compact ? "text-[11px] leading-snug" : "text-xs"
        )}
      >
        <ProductSourceBadge
          fromSubiekt={line.fromSubiekt}
          className={cn("mt-0.5 shrink-0", compact ? "size-4" : "size-5")}
        />
        <span className="min-w-0 flex-1">
          {line.products}
          <InformacjaFlowLineBadge line={line} className="ml-1.5" />
        </span>
      </p>
      {hasMeta ? (
        <p className={cn("mt-0.5 text-slate-500", compact ? "pl-5 text-[10px]" : "text-xs")}>
          {line.symbol && line.symbol !== "-" ? line.symbol : null}
          {line.symbol && line.symbol !== "-" && line.quantity && line.quantity !== "-"
            ? " · "
            : null}
          {line.quantity && line.quantity !== "-" && line.quantity !== "—"
            ? line.quantity === "informacja"
              ? "Informacja o dostępności"
              : `Ilość: ${line.quantity}`
            : null}
        </p>
      ) : null}
      {line.clientName ? (
        <MyOrderAssignedClient
          name={line.clientName}
          className={cn(compact ? "mt-1 pl-5" : "mt-1.5")}
        />
      ) : null}
    </>
  );
}
