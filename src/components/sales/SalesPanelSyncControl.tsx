"use client";

import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { cn } from "@/lib/cn";

/** Stan live sync + auto-odświeżanie listy Moje zamówienia / notatnika. */
export function SalesPanelSyncControl({
  embedded = false,
  variant = "orders",
  compact = false,
}: {
  embedded?: boolean;
  variant?: "orders" | "notatnik";
  /** ZK — jedna linia bez drugiego akapitu po prawej. */
  compact?: boolean;
}) {
  const ctx = useSalesUpdates();
  const syncLabel = useSyncRelativeTime(
    ctx?.lastSyncedAt ?? null,
    ctx?.lastPollAt ?? null
  );

  if (!ctx) return null;

  const isNotatnik = variant === "notatnik";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400",
        embedded && !compact ? "border-t border-slate-200/60 pt-2" : ""
      )}
      role="group"
      aria-label={
        isNotatnik
          ? "Synchronizacja listy ZK z serwerem"
          : "Synchronizacja listy zamówień z serwerem"
      }
    >
      <span
        className={cn(
          "inline-flex h-1 w-1 shrink-0 rounded-full",
          ctx.hasUpdates ? "bg-amber-400" : "bg-emerald-400/70"
        )}
        aria-hidden
      />
      {ctx.hasUpdates ? (
        <span aria-live="polite" className="text-slate-500">
          Nowe informacje —{" "}
          <button
            type="button"
            onClick={ctx.refreshNow}
            className="font-medium text-indigo-600 underline decoration-indigo-300/60 underline-offset-2 hover:text-indigo-800"
          >
            odśwież
          </button>
        </span>
      ) : (
        <span aria-live="polite">
          Na bieżąco · {syncLabel}
          {isNotatnik ? " · auto przy zmianach w ZK" : null}
        </span>
      )}

      {isNotatnik && !compact ? (
        <span className="text-slate-400 sm:ml-auto sm:text-right">
          Odświeża automatycznie, gdy magazyn odhaczy towar w ZK.
        </span>
      ) : null}
    </div>
  );
}
