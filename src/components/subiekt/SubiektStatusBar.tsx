"use client";

import { useCallback, useEffect, useState } from "react";
import { actionGetSubiektAvailability } from "@/app/actions/subiekt";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import { cn } from "@/lib/cn";

const POLL_MS = 90_000;

export function SubiektStatusBar({
  initial,
  className,
}: {
  initial: SubiektAvailability;
  className?: string;
}) {
  const [status, setStatus] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setRefreshing(true);
    try {
      const next = await actionGetSubiektAvailability({ force });
      setStatus(next);
    } catch {
      setStatus((prev) =>
        prev.configured
          ? {
              ...prev,
              reachable: false,
              shortLabel: "Subiekt: offline",
              message:
                "Nie udało się sprawdzić połączenia — terminy bez danych z Subiekta.",
              checkedAt: Date.now(),
            }
          : prev
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!status.configured) return;
    const id = window.setInterval(() => {
      void refresh(false);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [status.configured, refresh]);

  const tone = !status.configured
    ? "muted"
    : status.reachable
      ? "ok"
      : "warn";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between",
        tone === "ok" && "border-emerald-200/90 bg-emerald-50/50 text-emerald-950",
        tone === "warn" && "border-amber-200/90 bg-amber-50/60 text-amber-950",
        tone === "muted" && "border-slate-200/90 bg-slate-50/80 text-slate-600",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="font-semibold">{status.shortLabel}</p>
        <p className="mt-0.5 leading-snug opacity-90">{status.message}</p>
      </div>
      {status.configured ? (
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
          className={cn(
            "shrink-0 self-start rounded-lg border px-2.5 py-1 text-xs font-medium transition sm:self-center",
            tone === "ok" &&
              "border-emerald-300/80 bg-white/80 text-emerald-900 hover:bg-white",
            tone === "warn" &&
              "border-amber-300/80 bg-white/80 text-amber-900 hover:bg-white",
            refreshing && "cursor-wait opacity-60"
          )}
        >
          {refreshing ? "Sprawdzam…" : "Sprawdź ponownie"}
        </button>
      ) : null}
    </div>
  );
}
