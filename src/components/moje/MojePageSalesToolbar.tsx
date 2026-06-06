"use client";

import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import {
  pageToolbarSizingClass,
  pageToolbarSurfaceClass,
} from "@/lib/ui/ontime-theme";

export function MojePageSalesToolbar() {
  const ctx = useSalesUpdates();
  if (!ctx) return null;

  return (
    <label
      className={cn(
        pageToolbarSurfaceClass,
        pageToolbarSizingClass,
        "w-full cursor-pointer text-slate-700 sm:w-auto"
      )}
    >
      <input
        type="checkbox"
        checked={ctx.autoRefresh}
        onChange={(e) => ctx.setAutoRefresh(e.target.checked)}
        className="size-3.5 shrink-0 rounded border-slate-300 text-indigo-600"
      />
      <span className="whitespace-nowrap">Odświeżaj listę co 3 min</span>
    </label>
  );
}
