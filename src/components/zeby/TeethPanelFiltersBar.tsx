"use client";

import type { ReactNode } from "react";
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

/** Select w pasku filtrów: 44px na telefonie, 40px od `sm` (DESIGN.md → Inputs). */
export const teethToolbarSelectClass =
  "min-h-11 min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-base text-slate-900 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:min-h-10 sm:text-sm";

function ToggleChip({
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
        "inline-flex min-h-11 w-full min-w-0 items-center justify-center text-sm sm:min-h-10 sm:w-auto sm:shrink-0",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
      )}
    >
      {label}
    </button>
  );
}

/** Zwarty pasek filtrów — zawsze widoczny, bez rozwijania. */
export function TeethPanelFiltersBar({
  filters,
  onChange,
  suppliers,
  salesPeople,
  showQueueFilters = true,
  leading,
  trailing,
  className,
}: {
  filters: TeethPanelFilters;
  onChange: (next: TeethPanelFilters) => void;
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
  /** Filtry specyficzne dla kolejki (specyfikacja, dane ogólne). */
  showQueueFilters?: boolean;
  /** Pole szukania na początku rzędu; na telefonie pierwsze, na pełną szerokość. */
  leading?: ReactNode;
  /** Dodatkowe kontrolki po prawej (np. sortowanie). */
  trailing?: ReactNode;
  className?: string;
}) {
  const activeCount = countActiveTeethPanelFilters(
    showQueueFilters ? filters : { ...filters, missingSpecOnly: false, verificationOnly: false },
  );

  return (
    <div
      role="search"
      aria-label="Filtry"
      className={cn("grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap", className)}
    >
      {leading ? <div className="col-span-2 min-w-0 sm:min-w-[11rem] sm:max-w-xs sm:flex-1">{leading}</div> : null}
      <select
        aria-label="Dostawca"
        value={filters.supplierId ?? ""}
        onChange={(e) => onChange({ ...filters, supplierId: e.target.value || null })}
        className={cn(teethToolbarSelectClass, "w-full sm:w-auto sm:max-w-[12rem]")}
      >
        <option value="">Wszyscy dostawcy</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Handlowiec"
        value={filters.salesPersonId ?? ""}
        onChange={(e) => onChange({ ...filters, salesPersonId: e.target.value || null })}
        className={cn(teethToolbarSelectClass, "w-full sm:w-auto sm:max-w-[12rem]")}
      >
        <option value="">Wszyscy handlowcy</option>
        {salesPeople.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {sp.name}
          </option>
        ))}
      </select>
      {showQueueFilters ? (
        <ToggleChip
          label="Tylko do uzupełnienia"
          active={filters.missingSpecOnly}
          onClick={() => onChange({ ...filters, missingSpecOnly: !filters.missingSpecOnly })}
        />
      ) : null}
      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_TEETH_PANEL_FILTERS)}
          className="min-h-11 px-1 text-sm font-medium text-indigo-700 hover:text-indigo-900 sm:min-h-10"
        >
          Wyczyść filtry
        </button>
      ) : null}
      {trailing ? (
        <div className="flex min-w-0 items-center justify-end gap-2 sm:ml-auto">{trailing}</div>
      ) : null}
    </div>
  );
}
