"use client";

import { cn } from "@/lib/cn";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import { IconCalendar } from "@/components/icons/StrokeIcons";
import type { TeethScheduledItem } from "@/lib/data/teeth-queue";

export function TeethPanelScheduleBanner({
  schedule,
  scheduleOnly,
}: {
  schedule: TeethScheduledItem;
  scheduleOnly?: boolean;
}) {
  const nextDate = schedule.computed_next_date;
  const isShifted = Boolean(
    schedule.shift_date &&
      schedule.computed_next_date &&
      schedule.shift_date !== schedule.computed_next_date,
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 sm:px-4 lg:px-5",
        scheduleOnly
          ? "border-b border-slate-200/80 bg-sky-50/30"
          : "border-y border-sky-200/60 bg-sky-50/25",
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700">
        <IconCalendar size={15} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-sky-900">
            {scheduleOnly ? "Zadanie z harmonogramu" : "Cykl z harmonogramu"}
          </span>
          {nextDate ? (
            <span className="text-xs tabular-nums text-sky-700">
              {isShifted ? (
                <>
                  {formatPlDate(nextDate)}{" "}
                  <span className="text-sky-500">(przesunięty)</span>
                </>
              ) : (
                formatPlDate(nextDate)
              )}
            </span>
          ) : null}
          {schedule.vacation_note ? (
            <span className="text-xs font-medium text-amber-700">
              {vacationNoteLabel(schedule.vacation_note)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-sky-700/80">
          {scheduleOnly
            ? "Brak indywidualnych próśb — zamów według cyklu lub dodaj ręcznie."
            : "Powtarzalny cykl zamówień — obok indywidualnych próśb handlowców."}
        </p>
      </div>
    </div>
  );
}
