"use client";

import type { DeliveryStats, OrderType, StatsMode } from "@/types/database";
import { buildSupplierLeadTimeHint } from "@/lib/orders/delivery-eta";
import { cn } from "@/lib/cn";

export function SupplierLeadTimeHint({
  stats,
  statsMode,
  orderType,
  className,
  compact = false,
}: {
  stats: DeliveryStats | null | undefined;
  statsMode: StatsMode;
  orderType?: OrderType;
  className?: string;
  compact?: boolean;
}) {
  const hint = buildSupplierLeadTimeHint(stats, statsMode, {
    orderType,
    fromPlacementDate: orderType && orderType !== "None" ? new Date() : undefined,
  });

  if (!hint.lines.length) return null;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5 text-xs leading-relaxed",
        hint.hasData
          ? "border-indigo-200 bg-indigo-50/80 text-indigo-950"
          : "border-amber-200 bg-amber-50/90 text-amber-950",
        hint.lowConfidence && hint.hasData && "border-amber-200/80 bg-amber-50/50",
        compact && "py-2",
        className
      )}
      role="note"
    >
      <p className={cn("font-semibold", compact ? "text-[11px]" : "text-xs")}>
        Szacowany czas dostawy
      </p>
      <ul className={cn("mt-1 space-y-0.5", compact && "mt-0.5")}>
        {hint.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
