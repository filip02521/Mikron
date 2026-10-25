"use client";

import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

/** Stan live sync — obok przełącznika widoku, na wszystkich widokach panelu. */
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
            {/* Przycisk „Odśwież panel” jest w pasku nad treścią — tu tylko stan. */}
            Wykryto zmiany - odświeżamy panel…
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
