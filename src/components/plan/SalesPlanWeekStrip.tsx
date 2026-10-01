"use client";

import { useMemo, useState } from "react";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import { filterWeekDaysBySupplierIds } from "@/lib/orders/plan-preview";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { Badge } from "@/components/ui/Badge";
import { SALES_PLAN_COPY } from "@/lib/sales/sales-plan-ui-copy";

const C = SALES_PLAN_COPY;

type WeekScope = "mine" | "all";
type WeekWhich = "this" | "next";

export function SalesPlanWeekStrip({
  thisWeekDays,
  nextWeekDays,
  prioritySupplierIds,
  className,
}: {
  thisWeekDays: WeekDayPlan[];
  nextWeekDays: WeekDayPlan[];
  prioritySupplierIds: string[];
  className?: string;
}) {
  const prioritySet = useMemo(
    () => new Set(prioritySupplierIds),
    [prioritySupplierIds]
  );
  const hasMine = prioritySet.size > 0;
  const [scope, setScope] = useState<WeekScope>(hasMine ? "mine" : "all");
  const [which, setWhich] = useState<WeekWhich>("this");

  const effectiveScope: WeekScope = hasMine ? scope : "all";

  const sourceDays = which === "this" ? thisWeekDays : nextWeekDays;
  const days = useMemo(() => {
    if (effectiveScope === "mine" && prioritySet.size > 0) {
      return filterWeekDaysBySupplierIds(sourceDays, prioritySet);
    }
    return sourceDays;
  }, [effectiveScope, sourceDays, prioritySet]);

  return (
    <div className={cn("border-t border-slate-100", className)}>
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className={cn(salesTypography.blockTitle)}>{C.weekTitle}</p>
          <p className={cn("mt-0.5", salesTypography.sectionHint)}>{C.weekHint}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToggleGroup
            ariaLabel={C.weekScopeAria}
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: "mine", label: C.weekMine, disabled: !hasMine },
              { value: "all", label: C.weekAll },
            ]}
          />
          <ToggleGroup
            ariaLabel={C.weekWhichAria}
            value={which}
            onChange={setWhich}
            options={[
              { value: "this", label: C.weekThis },
              { value: "next", label: C.weekNext },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto px-2 pb-3 sm:px-3">
        <div className="grid min-w-[36rem] grid-cols-5 gap-1.5 sm:min-w-0 sm:gap-2">
          {days.map((day) => (
            <DayColumn
              key={day.dateKey}
              day={day}
              prioritySet={prioritySet}
              muteNonPriority={effectiveScope === "all" && hasMine}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DayColumn({
  day,
  prioritySet,
  muteNonPriority,
}: {
  day: WeekDayPlan;
  prioritySet: Set<string>;
  muteNonPriority: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-h-[6.5rem] flex-col rounded-md border border-slate-200 bg-white",
        day.isToday && "border-sky-200 bg-sky-50/40"
      )}
    >
      <header className="border-b border-slate-100 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {day.weekdayLabel}
          </p>
          {day.isToday ? (
            <Badge variant="info" className="px-1.5 py-0 text-[9px] uppercase">
              {C.weekToday}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs font-semibold text-slate-900">{day.dateLabel}</p>
      </header>
      <ul className="flex flex-1 flex-col gap-1 p-1.5">
        {!day.items.length ? (
          <li className="flex flex-1 items-center justify-center px-1 py-3 text-center text-[10px] text-slate-400">
            —
          </li>
        ) : (
          day.items.map((item) => {
            const mine = prioritySet.has(item.supplierId);
            const muted = muteNonPriority && !mine;
            return (
              <li
                key={`${day.dateKey}-${item.supplierId}-${item.scheduleId}`}
                className={cn(
                  "truncate rounded px-1.5 py-1 text-[11px] leading-snug",
                  mine
                    ? "bg-indigo-50 font-medium text-indigo-950"
                    : "bg-slate-50 text-slate-700",
                  muted && "opacity-45"
                )}
                title={item.flaggedName || item.supplierName}
              >
                {item.flaggedName || item.supplierName}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
