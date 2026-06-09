"use client";

import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

const LEGEND_ITEMS = [
  { barClass: "bg-emerald-500", label: "Do odbioru" },
  { barClass: "bg-amber-500", label: "Po terminie" },
  { barClass: "bg-sky-500", label: "Część na magazynie" },
  { barClass: "bg-violet-400", label: "Informacyjna" },
] as const;

/** Jednowierszowa legenda kolorów krawędzi wiersza — obok filtrów. */
export function MyOrdersRowLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5",
        salesTypography.chrome,
        className
      )}
      aria-label="Znaczenie kolorów wierszy"
    >
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
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
