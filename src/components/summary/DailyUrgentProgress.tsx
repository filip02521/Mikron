"use client";

import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import type { DailyUrgentProgress as Progress } from "@/lib/orders/daily-urgent-progress";

export function DailyUrgentProgressBar({
  progress,
  className,
}: {
  progress: Progress;
  className?: string;
}) {
  if (!progress.hasWork) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500",
          className
        )}
      >
        Brak zamówień harmonogramu na dziś — sprawdź prośby handlowców lub plan tygodnia.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white px-4 py-3.5 sm:px-5",
        progress.complete && "border-emerald-200 bg-emerald-50/40",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {progress.complete ? "Harmonogram na dziś domknięty" : "Postęp harmonogramu"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {progress.complete
              ? `Wszystkie ${progress.total} zamówienia z listy zaległe / na dziś są obsłużone.`
              : progress.remaining > 0
                ? `Zostało ${progress.remaining} z ${progress.total} · zrobione ${progress.done}`
                : `Zrobione ${progress.done} z ${progress.total}`}
          </p>
        </div>
        <p
          className={cn(
            "flex shrink-0 items-center justify-end gap-1 text-2xl font-semibold tabular-nums tracking-tight",
            progress.complete ? "text-emerald-700" : "text-slate-900"
          )}
        >
          {progress.complete ? (
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100">
              <IconCircleCheck size={22} strokeWidth={2.25} aria-hidden />
            </span>
          ) : (
            `${progress.percent}%`
          )}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            progress.complete ? "bg-emerald-500" : "bg-sky-500"
          )}
          style={{ width: `${progress.complete ? 100 : progress.percent}%` }}
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Postęp zamówień harmonogramu na dziś"
        />
      </div>
    </div>
  );
}
