"use client";

import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

/** Stan live sync — sticky chrome na wszystkich zakładkach panelu. */
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
        "flex items-center gap-2",
        embedded ? "pt-0.5" : ""
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
    </div>
  );
}
