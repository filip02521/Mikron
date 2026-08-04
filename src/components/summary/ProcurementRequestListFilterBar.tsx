"use client";

import { useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { IconSun } from "@/components/icons/StrokeIcons";
import {
  shortProcurementFlagLabel,
  type ProcurementFlagDefinition,
  type ProcurementListFilter,
} from "@/lib/orders/procurement-request-flag";
import { PROCUREMENT_REQUEST_FLAG_COPY } from "@/lib/orders/procurement-request-flag-copy";
import {
  procurementListFilterBarClass,
  procurementListFilterChipClass,
  procurementListFilterChipIdleClass,
  procurementListFilterChipSelectedClass,
  procurementListFilterChipVacationIdleClass,
  procurementListFilterChipVacationSelectedClass,
  procurementListFilterCountClass,
  procurementListFilterCountEmptyClass,
  procurementListFilterCountSelectedClass,
  procurementListFilterTrackClass,
} from "@/lib/ui/procurement-status-chips";

type FilterItem = {
  id: ProcurementListFilter;
  label: string;
  kind: "default" | "vacation" | "manage";
};

function buildFilterItems(
  activeDefs: ProcurementFlagDefinition[]
): FilterItem[] {
  return [
    { id: "all", label: PROCUREMENT_REQUEST_FLAG_COPY.filterAll, kind: "default" },
    ...activeDefs.map((d) => ({
      id: d.id as ProcurementListFilter,
      label: shortProcurementFlagLabel(d.label, 14),
      kind: "default" as const,
    })),
    { id: "none", label: PROCUREMENT_REQUEST_FLAG_COPY.filterNone, kind: "default" },
    {
      id: "urlop_dostawcy",
      label: PROCUREMENT_REQUEST_FLAG_COPY.filterVacation,
      kind: "vacation" as const,
    },
  ];
}

export function ProcurementRequestListFilterBar({
  value,
  onChange,
  definitions = [],
  counts,
  onManageClick,
  className,
}: {
  value: ProcurementListFilter;
  onChange: (next: ProcurementListFilter) => void;
  definitions?: ProcurementFlagDefinition[];
  /** Liczba grup (próśb) pasujących do chipa — klucz = id filtra. */
  counts?: Record<string, number>;
  onManageClick?: () => void;
  className?: string;
}) {
  const activeDefs = useMemo(
    () =>
      [...definitions]
        .filter((d) => d.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [definitions]
  );
  const items = useMemo(() => buildFilterItems(activeDefs), [activeDefs]);

  useEffect(() => {
    if (value === "all" || value === "none" || value === "urlop_dostawcy") {
      return;
    }
    const stillValid = activeDefs.some(
      (d) => d.id.toLowerCase() === value.toLowerCase()
    );
    if (!stillValid) onChange("all");
  }, [activeDefs, value, onChange]);

  return (
    <div
      className={cn(procurementListFilterBarClass, className)}
      role="group"
      aria-label="Filtr flag i urlopu dostawcy"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {PROCUREMENT_REQUEST_FLAG_COPY.filterBarLabel}
        </p>
        {onManageClick ? (
          <button
            type="button"
            className="text-[10px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            onClick={onManageClick}
          >
            {PROCUREMENT_REQUEST_FLAG_COPY.manageFlags}
          </button>
        ) : null}
      </div>
      <div className={procurementListFilterTrackClass}>
        {items.map((item, index) => {
          const active = value === item.id;
          const count = counts?.[item.id];
          const showCount = typeof count === "number";
          const showDivider =
            item.kind === "vacation" ||
            (item.id === "none" && items[index - 1]?.kind === "default");
          return (
            <span key={item.id} className="contents">
              {showDivider && item.kind === "vacation" ? (
                <span
                  className="mx-0.5 hidden h-4 w-px shrink-0 bg-slate-200 sm:block"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                className={cn(
                  procurementListFilterChipClass,
                  item.kind === "vacation"
                    ? active
                      ? procurementListFilterChipVacationSelectedClass
                      : procurementListFilterChipVacationIdleClass
                    : active
                      ? procurementListFilterChipSelectedClass
                      : procurementListFilterChipIdleClass
                )}
                aria-pressed={active}
                aria-label={
                  showCount ? `${item.label}, ${count}` : item.label
                }
                onClick={() => onChange(item.id)}
              >
                {item.kind === "vacation" ? (
                  <IconSun
                    size={12}
                    strokeWidth={2.25}
                    className={cn(
                      "shrink-0",
                      active ? "text-amber-700" : "text-amber-600/80"
                    )}
                    aria-hidden
                  />
                ) : null}
                <span>{item.label}</span>
                {showCount ? (
                  <span
                    className={cn(
                      procurementListFilterCountClass,
                      active && procurementListFilterCountSelectedClass,
                      count === 0 && procurementListFilterCountEmptyClass
                    )}
                    aria-hidden
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
