"use client";

import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

const LEGEND_ITEMS = [
  { id: "pickup", barClass: "bg-emerald-500", label: "Gotowe" },
  { id: "overdue", barClass: "bg-amber-500", label: "Po terminie" },
  { id: "partial", barClass: "bg-sky-500", label: "Część na magazynie" },
  { id: "informacja", barClass: "bg-violet-400", label: "Informacyjna" },
] as const;

/** Jednowierszowa legenda kolorów krawędzi wiersza — obok filtrów. */
export function MyOrdersRowLegend({
  className,
  hidePickup = false,
}: {
  className?: string;
  /** Ukryj „Gotowe”, gdy filtr odbioru jest już aktywny. */
  hidePickup?: boolean;
}) {
  const items = hidePickup ? LEGEND_ITEMS.filter((item) => item.id !== "pickup") : LEGEND_ITEMS;
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5",
        salesTypography.chrome,
        className
      )}
      aria-label="Znaczenie kolorów wierszy"
    >
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-3 w-1 shrink-0 rounded-full", item.barClass)}
            aria-hidden
          />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
