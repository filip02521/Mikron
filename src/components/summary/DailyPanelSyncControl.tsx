"use client";

import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

/** Stan live sync + auto-odświeżanie — sticky chrome na wszystkich zakładkach panelu. */
export function DailyPanelSyncControl({ embedded = false }: { embedded?: boolean }) {
  const ctx = useOperationsUpdates();
  const syncLabel = useSyncRelativeTime(
    ctx?.lastSyncedAt ?? null,
    ctx?.lastPollAt ?? null
  );

  if (!ctx) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2",
        embedded ? "border-t border-slate-200/60 pt-2.5" : ""
      )}
      role="group"
      aria-label="Synchronizacja panelu z serwerem"
    >
      <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", panelTypography.chrome)}>
        <span
          className={cn(
            "inline-flex h-2 w-2 shrink-0 rounded-full sm:h-1.5 sm:w-1.5",
            ctx.hasUpdates ? "bg-amber-400" : "bg-emerald-500"
          )}
          aria-hidden
        />
        {ctx.hasUpdates ? (
          <span aria-live="polite" className="text-slate-700">
            Są nowe zmiany w kolejce —{" "}
            <button
              type="button"
              onClick={ctx.refreshNow}
              className="min-h-9 rounded-sm font-semibold text-indigo-700 underline decoration-indigo-300/80 underline-offset-2 hover:text-indigo-900 sm:min-h-0"
            >
              odśwież widok
            </button>
          </span>
        ) : (
          <span aria-live="polite">
            Na bieżąco · {syncLabel}
            <span className="text-slate-400"> · co 25 s</span>
          </span>
        )}
      </div>

      <label
        className={cn(
          "inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-medium shadow-sm transition-colors sm:min-h-0 sm:w-fit sm:justify-start sm:gap-2 sm:px-2.5 sm:py-1.5",
          panelTypography.chrome,
          ctx.autoRefresh
            ? "border-indigo-200/90 bg-indigo-50/50 text-indigo-900"
            : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30"
        )}
      >
        <span className="whitespace-nowrap">Auto przy zmianach</span>
        <input
          type="checkbox"
          role="switch"
          aria-checked={ctx.autoRefresh}
          aria-label="Automatyczne odświeżanie panelu przy wykrytych zmianach co 3 minuty"
          checked={ctx.autoRefresh}
          onChange={(e) => ctx.setAutoRefresh(e.target.checked)}
          className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 sm:size-4"
        />
      </label>
    </div>
  );
}
