"use client";

import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";

export function MojePageSalesToolbar() {
  const ctx = useSalesUpdates();
  if (!ctx) return null;

  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-snug text-slate-700",
        "min-h-11 sm:w-auto sm:min-h-0"
      )}
    >
      <input
        type="checkbox"
        checked={ctx.autoRefresh}
        onChange={(e) => ctx.setAutoRefresh(e.target.checked)}
        className="rounded border-slate-300"
      />
      Odświeżaj listę co 3 min
    </label>
  );
}
