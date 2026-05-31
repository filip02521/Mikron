"use client";

import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import {
  brandGradientTextClass,
  legendDotForSomeoneClass,
  legendDotUrgentClass,
  progressFillForSomeoneClass,
  progressFillUrgentClass,
} from "@/lib/ui/ontime-theme";

export function DailyDayProgressBar({
  progress,
  className,
  variant = "default",
}: {
  progress: DailyDayProgress;
  className?: string;
  variant?: "default" | "compact";
}) {
  const { combined, urgent, forSomeone } = progress;

  if (variant === "compact") {
    if (!combined.hasWork) return null;

    const urgentDoneWidth =
      combined.total > 0 ? (urgent.done / combined.total) * 100 : 0;
    const forSomeoneDoneWidth =
      combined.total > 0 ? (forSomeone.done / combined.total) * 100 : 0;

    return (
      <div
        className={cn("flex min-w-0 items-center gap-2 sm:gap-3", className)}
        role="progressbar"
        aria-valuenow={combined.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Postęp dnia"
      >
        <div className="flex h-1.5 min-w-[5rem] flex-1 overflow-hidden rounded-full bg-slate-200/80">
          {urgentDoneWidth > 0 ? (
            <div
              className={cn("h-full transition-all duration-500", progressFillUrgentClass)}
              style={{ width: `${urgentDoneWidth}%` }}
            />
          ) : null}
          {forSomeoneDoneWidth > 0 ? (
            <div
              className={cn("h-full transition-all duration-500", progressFillForSomeoneClass)}
              style={{ width: `${forSomeoneDoneWidth}%` }}
            />
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">
          {combined.percent}%
        </span>
        <span className="hidden min-w-0 truncate text-[11px] text-slate-500 sm:inline">
          harm. {urgent.done}/{urgent.total} · prośby {forSomeone.done}/{forSomeone.total}
        </span>
      </div>
    );
  }

  if (!combined.hasWork) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500",
          className
        )}
      >
        Brak pozycji do domknięcia dziś — sprawdź plan tygodnia poniżej.
      </div>
    );
  }

  const urgentDoneWidth =
    combined.total > 0 ? (urgent.done / combined.total) * 100 : 0;
  const forSomeoneDoneWidth =
    combined.total > 0 ? (forSomeone.done / combined.total) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200/80 bg-white px-4 py-3.5 shadow-[var(--shadow-card-elevated)] sm:px-5",
        combined.complete && "border-emerald-200 bg-emerald-50/40",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {combined.complete ? "Dzień domknięty" : "Postęp dnia"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {combined.complete
              ? `Obsłużono ${combined.total} pozycji (harmonogram i prośby).`
              : `Zostało ${combined.remaining} z ${combined.total} · harmonogram ${urgent.remaining} · prośby ${forSomeone.remaining}`}
          </p>
        </div>
        {combined.complete ? (
          <span className="shrink-0 text-emerald-600" role="img" aria-label="Dzień domknięty">
            <IconCircleCheck size={28} />
          </span>
        ) : (
          <p className={cn("shrink-0 text-2xl font-semibold tabular-nums tracking-tight", brandGradientTextClass)}>
            {combined.percent}%
          </p>
        )}
      </div>

      <div
        className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200/80"
        role="progressbar"
        aria-valuenow={combined.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Postęp dnia — harmonogram i prośby handlowców"
      >
        {urgentDoneWidth > 0 ? (
          <div
            className={cn("h-full transition-all duration-500", progressFillUrgentClass)}
            style={{ width: `${urgentDoneWidth}%` }}
            title={`Harmonogram: ${urgent.done}/${urgent.total}`}
          />
        ) : null}
        {forSomeoneDoneWidth > 0 ? (
          <div
            className={cn("h-full transition-all duration-500", progressFillForSomeoneClass)}
            style={{ width: `${forSomeoneDoneWidth}%` }}
            title={`Prośby: ${forSomeone.done}/${forSomeone.total}`}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {urgent.hasWork ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={legendDotUrgentClass} aria-hidden />
            Harmonogram {urgent.done}/{urgent.total}
          </span>
        ) : null}
        {forSomeone.hasWork ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={legendDotForSomeoneClass} aria-hidden />
            Prośby {forSomeone.done}/{forSomeone.total}
          </span>
        ) : null}
      </div>
    </div>
  );
}
