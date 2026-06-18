"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { actionGetSubiektAvailability } from "@/app/actions/subiekt";
import { IconAlertCircle, IconLinkOff } from "@/components/icons/StrokeIcons";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";

const POLL_MS = 90_000;

type StatusTone = "warn" | "muted";

function toneForStatus(status: SubiektAvailability): StatusTone {
  return status.configured ? "warn" : "muted";
}

function pickNewerSubiektStatus(
  initial: SubiektAvailability,
  polled: SubiektAvailability | null
): SubiektAvailability {
  if (!polled) return initial;
  if (polled.checkedAt >= initial.checkedAt) return polled;
  return initial;
}

export function SubiektStatusBar({
  initial,
  className,
  embedded = false,
  compact = false,
  onStatusChange,
}: {
  initial: SubiektAvailability;
  className?: string;
  /** Wewnątrz karty Moje — pełna szerokość bez zaokrąglenia zewnętrznego. */
  embedded?: boolean;
  /** ZK — ciaśniejszy wiersz pod paskiem sync. */
  compact?: boolean;
  onStatusChange?: (status: SubiektAvailability) => void;
}) {
  const [polledStatus, setPolledStatus] = useState<SubiektAvailability | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const status = useMemo(
    () => pickNewerSubiektStatus(initial, polledStatus),
    [initial, polledStatus]
  );

  const refresh = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const next = await actionGetSubiektAvailability({ force });
      setPolledStatus(next);
      onStatusChange?.(next);
    } catch {
      setPolledStatus((prev) => {
        const base = pickNewerSubiektStatus(initial, prev);
        const fallback =
          base.configured
            ? {
                ...base,
                reachable: false,
                shortLabel: "System magazynowy: niedostępny",
                message:
                  "Nie udało się sprawdzić połączenia — szacunki terminów pochodzą z historii dostaw.",
                checkedAt: Date.now(),
              }
            : base;
        onStatusChange?.(fallback);
        return fallback;
      });
    } finally {
      setRefreshing(false);
    }
  }, [initial, onStatusChange]);

  useEffect(() => {
    if (!status.configured) return;
    const id = window.setInterval(() => {
      void refresh(false);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [status.configured, refresh]);

  if (status.reachable) return null;

  const tone = toneForStatus(status);
  const Icon = tone === "warn" ? IconAlertCircle : IconLinkOff;

  return (
    <div
      className={cn(
        compact
          ? "flex flex-col gap-2 border-t border-amber-100/80 bg-amber-50/35 px-3 py-2 text-xs leading-snug sm:flex-row sm:items-center sm:justify-between sm:px-4"
          : "flex flex-col gap-2 text-xs leading-relaxed sm:flex-row sm:items-start sm:justify-between",
        !compact &&
          embedded &&
          cn(
            "border-b px-3 py-2.5 sm:px-4",
            tone === "warn" && "border-amber-100 bg-amber-50/70 text-amber-950",
            tone === "muted" && "border-slate-100 bg-slate-50/80 text-slate-700"
          ),
        !compact &&
          !embedded &&
          cn(
            "rounded-md border px-3 py-2.5",
            tone === "warn" && "border-amber-200/90 bg-amber-50/60 text-amber-950",
            tone === "muted" && "border-slate-200/90 bg-slate-50/80 text-slate-600"
          ),
        compact && (tone === "warn" ? "text-amber-950" : "text-slate-700"),
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("flex min-w-0 gap-2", compact ? "items-center" : "gap-2.5 items-start")}>
        <Icon
          size={compact ? 15 : 16}
          strokeWidth={2}
          className={cn(
            compact ? "shrink-0" : "mt-0.5 shrink-0",
            tone === "warn" ? "text-amber-700" : "text-slate-500"
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-semibold">{status.shortLabel}</p>
          <p
            className={cn(
              "mt-0.5 opacity-90",
              compact && "line-clamp-2 text-amber-900/80"
            )}
          >
            {status.message}
          </p>
        </div>
      </div>
      {status.configured ? (
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
          className={cn(
            pageToolbarSurfaceClass,
            compact ? "h-8 px-2.5 text-[0.68rem]" : pageToolbarSizingClass,
            "shrink-0 self-start border-amber-300/80 text-amber-900 hover:bg-amber-50/80 sm:self-center",
            refreshing && "cursor-wait opacity-60"
          )}
        >
          {refreshing ? "Sprawdzam…" : compact ? "Sprawdź" : "Sprawdź ponownie"}
        </button>
      ) : null}
    </div>
  );
}
