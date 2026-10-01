"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  countActiveTeethPanelFilters,
  EMPTY_TEETH_PANEL_FILTERS,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";

export const teethToolbarSelectClass =
  "h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30";

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
        "inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
        active
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900",
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
  trailing,
  className,
}: {
  filters: TeethPanelFilters;
  onChange: (next: TeethPanelFilters) => void;
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
  /** Filtry specyficzne dla kolejki (specyfikacja, dane ogólne). */
  showQueueFilters?: boolean;
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
      <select
        aria-label="Dostawca"
        value={filters.supplierId ?? ""}
        onChange={(e) => onChange({ ...filters, supplierId: e.target.value || null })}
        className={cn(teethToolbarSelectClass, "w-full sm:w-auto sm:max-w-[14rem]")}
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
        className={cn(teethToolbarSelectClass, "w-full sm:w-auto sm:max-w-[14rem]")}
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
          className="h-9 px-1 text-sm font-medium text-indigo-700 hover:text-neutral-900"
        >
          Wyczyść filtry
        </button>
      ) : null}
      {trailing ? <div className="flex items-center justify-end gap-2 sm:ml-auto">{trailing}</div> : null}
    </div>
  );
}
