"use client";

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
  const activeCount = countActiveTeethPanelFilters(
    showQueueFilters ? filters : { ...filters, missingSpecOnly: false, verificationOnly: false },
  );

  return (
    <div className={cn(teethPanelFiltersBarClass, className)}>
      <div className="space-y-2">
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

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_TEETH_PANEL_FILTERS)}
            className="text-[11px] font-medium text-indigo-700 transition-colors hover:text-indigo-900"
          >
            Wyczyść wszystkie filtry ({activeCount})
          </button>
        ) : null}
      </div>
    </div>
  );
}
