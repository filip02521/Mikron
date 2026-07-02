"use client";

import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { Field, Select } from "@/components/ui/Field";
import {
  countActiveTeethPanelFilters,
  EMPTY_TEETH_PANEL_FILTERS,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import { teethPanelFiltersBarClass } from "@/lib/teeth/teeth-panel-ui";

function FilterToggleChip({
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
        "min-h-9 shrink-0 px-2.5 py-1.5 text-xs",
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
    <div
      className={cn(teethPanelFiltersBarClass, className)}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={panelTypography.sectionLabel}>Filtry</span>
            {activeCount > 0 ? (
              <span
                className="rounded-full bg-indigo-100/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-900 ring-1 ring-indigo-200/60"
                aria-live="polite"
              >
                {activeCount} {activeCount === 1 ? "aktywny" : "aktywne"}
              </span>
            ) : null}
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY_TEETH_PANEL_FILTERS)}
              className="text-[11px] font-medium text-indigo-700 transition-colors hover:text-indigo-900"
            >
              Wyczyść filtry
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:gap-4">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:max-w-lg">
            <Field label="Dostawca" className="min-w-0">
              <Select
                value={filters.supplierId ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, supplierId: e.target.value || null })
                }
                className="min-h-9 py-1.5"
              >
                <option value="">Wszyscy dostawcy</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Handlowiec" className="min-w-0">
              <Select
                value={filters.salesPersonId ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, salesPersonId: e.target.value || null })
                }
                className="min-h-9 py-1.5"
              >
                <option value="">Wszyscy handlowcy</option>
                {salesPeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {showQueueFilters ? (
            <div
              className="flex flex-wrap gap-1.5 lg:shrink-0 lg:pb-0.5"
              role="group"
              aria-label="Szybkie filtry"
            >
              <FilterToggleChip
                label="Do uzupełnienia"
                active={filters.missingSpecOnly}
                onClick={() =>
                  onChange({ ...filters, missingSpecOnly: !filters.missingSpecOnly })
                }
              />
              <FilterToggleChip
                label="Brak danych ogólnych"
                active={filters.verificationOnly}
                onClick={() =>
                  onChange({ ...filters, verificationOnly: !filters.verificationOnly })
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
