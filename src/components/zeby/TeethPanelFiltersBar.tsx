"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import {
  countActiveTeethPanelFilters,
  EMPTY_TEETH_PANEL_FILTERS,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import { teethPanelFiltersBarClass } from "@/lib/teeth/teeth-panel-ui";
import { receiveQueueToolbarSectionClass } from "@/lib/ui/queue-panel-styles";
import { queueToolbarFieldLabelClass } from "@/lib/ui/queue-panel-styles";
import { IconChevronDown } from "@/components/icons/StrokeIcons";

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
      )}
    >
      {label}
    </button>
  );
}

export function TeethPanelFiltersBar({
  filters,
  onChange,
  suppliers,
  salesPeople,
  showQueueFilters = true,
  className,
}: {
  filters: TeethPanelFilters;
  onChange: (next: TeethPanelFilters) => void;
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
  /** Filtry specyficzne dla kolejki (specyfikacja, dane ogólne). */
  showQueueFilters?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveTeethPanelFilters(
    showQueueFilters ? filters : { ...filters, missingSpecOnly: false, verificationOnly: false },
  );

  const activeSupplier = suppliers.find((s) => s.id === filters.supplierId);
  const activeSalesPerson = salesPeople.find((sp) => sp.id === filters.salesPersonId);

  const summaryParts: string[] = [];
  if (activeSupplier) summaryParts.push(activeSupplier.name);
  if (activeSalesPerson) summaryParts.push(activeSalesPerson.name);
  if (showQueueFilters && filters.missingSpecOnly) summaryParts.push("Do uzupełnienia");
  if (showQueueFilters && filters.verificationOnly) summaryParts.push("Brak danych ogólnych");

  return (
    <div className={cn(teethPanelFiltersBarClass, className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-1 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <IconChevronDown
            open={open}
            size={14}
            strokeWidth={2}
            className="shrink-0 text-slate-400"
          />
          <span className="text-xs font-semibold text-slate-700">Filtry</span>
          {activeCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-bold tabular-nums text-indigo-700">
              {activeCount}
            </span>
          ) : null}
          {summaryParts.length > 0 ? (
            <span className="hidden truncate text-[11px] text-slate-500 sm:inline">
              {summaryParts.join(" · ")}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeCount > 0 ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(EMPTY_TEETH_PANEL_FILTERS);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange(EMPTY_TEETH_PANEL_FILTERS);
                }
              }}
              className="text-[10px] font-medium text-indigo-700 transition hover:text-indigo-900"
            >
              Wyczyść
            </span>
          ) : null}
        </div>
      </button>

      {open ? (
      <div className="space-y-2 pt-1">
        <div className={cn(receiveQueueToolbarSectionClass, "border-slate-200/80 shadow-none")}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={queueToolbarFieldLabelClass}>Dostawca</span>
            {filters.supplierId ? (
              <button
                type="button"
                onClick={() => onChange({ ...filters, supplierId: null })}
                className="text-[10px] font-medium text-indigo-700 transition hover:text-indigo-900"
              >
                Wyczyść
              </button>
            ) : null}
          </div>
          <div
            className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
            role="group"
            aria-label="Filtr dostawcy"
          >
            <FilterChip
              label="Wszyscy"
              active={!filters.supplierId}
              onClick={() => onChange({ ...filters, supplierId: null })}
            />
            {suppliers.map((s) => (
              <FilterChip
                key={s.id}
                label={s.name}
                active={filters.supplierId === s.id}
                onClick={() =>
                  onChange({
                    ...filters,
                    supplierId: filters.supplierId === s.id ? null : s.id,
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className={cn(receiveQueueToolbarSectionClass, "border-slate-200/80 shadow-none")}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={queueToolbarFieldLabelClass}>Handlowiec</span>
            {filters.salesPersonId ? (
              <button
                type="button"
                onClick={() => onChange({ ...filters, salesPersonId: null })}
                className="text-[10px] font-medium text-indigo-700 transition hover:text-indigo-900"
              >
                Wyczyść
              </button>
            ) : null}
          </div>
          <div
            className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
            role="group"
            aria-label="Filtr handlowca"
          >
            <FilterChip
              label="Wszyscy"
              active={!filters.salesPersonId}
              onClick={() => onChange({ ...filters, salesPersonId: null })}
            />
            {salesPeople.map((sp) => (
              <FilterChip
                key={sp.id}
                label={sp.name}
                active={filters.salesPersonId === sp.id}
                onClick={() =>
                  onChange({
                    ...filters,
                    salesPersonId: filters.salesPersonId === sp.id ? null : sp.id,
                  })
                }
              />
            ))}
          </div>
        </div>

        {showQueueFilters ? (
          <div className={cn(receiveQueueToolbarSectionClass, "border-slate-200/80 shadow-none")}>
            <span className={queueToolbarFieldLabelClass}>Szybkie filtry</span>
            <div
              className="mt-1.5 flex flex-wrap gap-1.5"
              role="group"
              aria-label="Szybkie filtry"
            >
              <FilterChip
                label="Do uzupełnienia"
                active={filters.missingSpecOnly}
                onClick={() =>
                  onChange({ ...filters, missingSpecOnly: !filters.missingSpecOnly })
                }
              />
              <FilterChip
                label="Brak danych ogólnych"
                active={filters.verificationOnly}
                onClick={() =>
                  onChange({ ...filters, verificationOnly: !filters.verificationOnly })
                }
              />
            </div>
          </div>
        ) : null}

      </div>
      ) : null}
    </div>
  );
}
