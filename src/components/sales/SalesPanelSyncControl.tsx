"use client";

import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass, salesTypography } from "@/lib/ui/ontime-theme";

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
  const hydrated = useClientHydrated();
  const autoRefresh = hydrated && ctx ? ctx.autoRefresh : false;
  const boardAnswerSound = hydrated && ctx ? ctx.boardAnswerSound : false;
  const syncLabel = useSyncRelativeTime(
    ctx?.lastSyncedAt ?? null,
    ctx?.lastPollAt ?? null
  );

  if (!ctx) return null;

  const isNotatnik = variant === "notatnik";

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2",
        embedded && !compact ? "border-t border-slate-200/60 pt-2" : ""
      )}
      role="group"
      aria-label={
        isNotatnik
          ? "Synchronizacja listy ZK z serwerem"
          : "Synchronizacja listy zamówień z serwerem"
      }
    >
      <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", salesTypography.chrome)}>
        <span
          className={cn(
            "inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
            ctx.hasUpdates ? "bg-amber-400" : "bg-emerald-500"
          )}
          aria-hidden
        />
        {ctx.hasUpdates ? (
          <span aria-live="polite" className="text-slate-700">
            Są nowe informacje —{" "}
            <button
              type="button"
              onClick={ctx.refreshNow}
              className="min-h-11 rounded-sm font-semibold text-indigo-700 underline decoration-indigo-300/80 underline-offset-2 hover:text-indigo-900 sm:min-h-0"
            >
              odśwież widok
            </button>
          </span>
        ) : (
          <span aria-live="polite">
            Na bieżąco · {syncLabel}
            <span className="text-slate-400">
              {" "}
              · co 45 s
              {isNotatnik ? " · auto przy zmianach w ZK" : null}
            </span>
          </span>
        )}
      </div>

      {isNotatnik && !compact ? (
        <p className={cn(salesTypography.chrome, "text-slate-500 sm:text-right")}>
          Odświeża automatycznie, gdy magazyn odhaczy towar w ZK.
        </p>
      ) : !isNotatnik ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label
            className={cn(
              pageToolbarSurfaceClass,
              pageToolbarSizingClass,
              "min-h-11 w-full cursor-pointer justify-between gap-3 sm:min-h-10 sm:w-fit sm:justify-start",
              salesTypography.chrome,
              boardAnswerSound
                ? "border-amber-200/90 bg-amber-50/45 text-amber-950"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-amber-100 hover:bg-amber-50/25"
            )}
          >
            <span className="whitespace-nowrap">Dźwięk przy odpowiedzi</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={boardAnswerSound}
              aria-label="Powiadomienie dźwiękowe, gdy zakupy odpowiedzą na Twoje pytanie na tablicy"
              checked={boardAnswerSound}
              onChange={(e) => ctx.setBoardAnswerSound(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-300 sm:size-4"
            />
          </label>

          <label
            className={cn(
              pageToolbarSurfaceClass,
              pageToolbarSizingClass,
              "min-h-11 w-full cursor-pointer justify-between gap-3 sm:min-h-10 sm:w-fit sm:justify-start",
              salesTypography.chrome,
              autoRefresh
                ? "border-indigo-200/90 bg-indigo-50/50 text-indigo-900"
                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-indigo-100 hover:bg-indigo-50/30"
            )}
          >
            <span className="whitespace-nowrap">Auto przy zmianach</span>
            <input
              type="checkbox"
              role="switch"
              aria-checked={autoRefresh}
              aria-label="Automatyczne odświeżanie listy przy wykrytych zmianach co 3 minuty"
              checked={autoRefresh}
              onChange={(e) => ctx.setAutoRefresh(e.target.checked)}
              className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300 sm:size-4"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
