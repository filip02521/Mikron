"use client";

import { useCallback, useEffect, useState } from "react";
import { actionGetSubiektAvailability } from "@/app/actions/subiekt";
import { IconAlertCircle, IconLinkOff } from "@/components/icons/StrokeIcons";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import { cn } from "@/lib/cn";
import { mojeSecondaryControlClass } from "@/lib/ui/ontime-theme";

const POLL_MS = 90_000;

type StatusTone = "warn" | "muted";

function toneForStatus(status: SubiektAvailability): StatusTone {
  return status.configured ? "warn" : "muted";
}

export function SubiektStatusBar({
  initial,
  className,
  embedded = false,
  onStatusChange,
}: {
  initial: SubiektAvailability;
  className?: string;
  /** Wewnątrz karty Moje — pełna szerokość bez zaokrąglenia zewnętrznego. */
  embedded?: boolean;
  onStatusChange?: (status: SubiektAvailability) => void;
}) {
  const [status, setStatus] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const next = await actionGetSubiektAvailability({ force });
      setStatus(next);
      onStatusChange?.(next);
    } catch {
      setStatus((prev) => {
        const fallback =
          prev.configured
            ? {
                ...prev,
                reachable: false,
                shortLabel: "System magazynowy: niedostępny",
                message:
                  "Nie udało się sprawdzić połączenia — szacunki terminów pochodzą z historii dostaw.",
                checkedAt: Date.now(),
              }
            : prev;
        onStatusChange?.(fallback);
        return fallback;
      });
    } finally {
      setRefreshing(false);
    }
  }, [onStatusChange]);

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
        "flex flex-col gap-2 text-xs leading-relaxed sm:flex-row sm:items-start sm:justify-between",
        embedded
          ? cn(
              "border-b px-3 py-2.5 sm:px-4",
              tone === "warn" &&
                "border-amber-100 bg-amber-50/70 text-amber-950",
              tone === "muted" &&
                "border-slate-100 bg-slate-50/80 text-slate-700"
            )
          : cn(
              "rounded-md border px-3 py-2.5",
              tone === "warn" &&
                "border-amber-200/90 bg-amber-50/60 text-amber-950",
              tone === "muted" &&
                "border-slate-200/90 bg-slate-50/80 text-slate-600"
            ),
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 gap-2.5">
        <Icon
          size={16}
          strokeWidth={2}
          className={cn(
            "mt-0.5 shrink-0",
            tone === "warn" ? "text-amber-700" : "text-slate-500"
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-semibold">{status.shortLabel}</p>
          <p className="mt-0.5 opacity-90">{status.message}</p>
        </div>
      </div>
      {status.configured ? (
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
          className={cn(
            mojeSecondaryControlClass,
            "shrink-0 self-start border-amber-300/80 text-amber-900 hover:bg-amber-50/80 sm:self-center",
            refreshing && "cursor-wait opacity-60"
          )}
        >
          {refreshing ? "Sprawdzam…" : "Sprawdź ponownie"}
        </button>
      ) : null}
    </div>
  );
}
