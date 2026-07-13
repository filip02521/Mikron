"use client";

import Link from "next/link";
import { Input } from "@/components/ui/Field";
import { SupplierLocationFilters } from "@/components/admin/SupplierLocationFilters";
import { SupplierSubiektFilters } from "@/components/admin/SupplierSubiektFilters";
import { cn } from "@/lib/cn";
import { supplierHubPaths, type SupplierHubContext } from "@/lib/supplier-hub";
import {
  SUPPLIER_LOCATION_OPTIONS,
  type SupplierLocationCounts,
  type SupplierLocationFilter,
  type SupplierSubiektCounts,
  type SupplierSubiektFilter,
} from "@/lib/supplier-locations";
import type { SupplierLocation } from "@/types/database";

export const supplierHubFilterBarClass =
  "space-y-4 border-b border-slate-100 bg-slate-50/40 px-3 pb-4 pt-3 sm:px-4 lg:px-5";

export const supplierHubFilterGridClass =
  "grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(220px,280px)] xl:items-end";

export function SupplierHubFilterLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500",
        className
      )}
    >
      {children}
    </p>
  );
}

export function SupplierHubSearchField({
  id,
  value,
  onChange,
  placeholder = "Szukaj po nazwie…",
  ariaLabel = "Szukaj po nazwie",
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <SupplierHubFilterLabel>
        <label htmlFor={id}>Szukaj</label>
      </SupplierHubFilterLabel>
      <Input
        id={id}
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SupplierAdminCardsFilterBar({
  locationFilter,
  onLocationFilterChange,
  locationCounts,
  subiektFilter,
  onSubiektFilterChange,
  subiektCounts,
  search,
  onSearchChange,
  searchId,
  searchPlaceholder,
  searchAriaLabel,
}: {
  locationFilter: SupplierLocationFilter;
  onLocationFilterChange: (value: SupplierLocationFilter) => void;
  locationCounts: SupplierLocationCounts;
  subiektFilter: SupplierSubiektFilter;
  onSubiektFilterChange: (value: SupplierSubiektFilter) => void;
  subiektCounts: SupplierSubiektCounts;
  search: string;
  onSearchChange: (value: string) => void;
  searchId: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
}) {
  return (
    <div className={supplierHubFilterBarClass}>
      <div className={supplierHubFilterGridClass}>
        <SupplierLocationFilters
          value={locationFilter}
          onChange={onLocationFilterChange}
          counts={locationCounts}
          className="min-w-0"
        />
        <SupplierSubiektFilters
          value={subiektFilter}
          onChange={onSubiektFilterChange}
          counts={subiektCounts}
          className="min-w-0"
        />
        <SupplierHubSearchField
          id={searchId}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
        />
      </div>
    </div>
  );
}

export function ScheduleRouteLocationFilters({
  value,
  context,
  className,
}: {
  value: SupplierLocation;
  context: SupplierHubContext;
  className?: string;
}) {
  const paths = supplierHubPaths(context);

  return (
    <div className={cn("min-w-0", className)}>
      <SupplierHubFilterLabel>Lokalizacja</SupplierHubFilterLabel>
      <div
        role="group"
        aria-label="Lokalizacja terminów"
        className="inline-flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-50/80 p-0.5"
      >
        {SUPPLIER_LOCATION_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Link
              key={opt.value}
              href={paths.schedule(opt.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "min-w-0 truncate rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:min-h-10 sm:px-3 sm:py-2.5 sm:text-sm lg:min-h-0 lg:py-1.5",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
              )}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type ScheduleTermFilterKey = "all" | "overdue" | "week" | "vacation";

const SCHEDULE_TERM_OPTIONS: {
  value: ScheduleTermFilterKey;
  label: string;
  activeClass: string;
}[] = [
  { value: "all", label: "Wszystkie", activeClass: "bg-indigo-600 text-white" },
  { value: "overdue", label: "Po terminie", activeClass: "bg-amber-600 text-white" },
  { value: "week", label: "Ten tydzień", activeClass: "bg-sky-600 text-white" },
  { value: "vacation", label: "Z urlopem", activeClass: "bg-violet-600 text-white" },
];

export function ScheduleTermFilters({
  value,
  onChange,
  counts,
  className,
}: {
  value: ScheduleTermFilterKey;
  onChange: (value: ScheduleTermFilterKey) => void;
  counts: Record<ScheduleTermFilterKey, number>;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <SupplierHubFilterLabel>Status terminu</SupplierHubFilterLabel>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr statusu terminu">
        {SCHEDULE_TERM_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:min-h-10 sm:px-3 sm:text-sm lg:min-h-0 lg:py-1.5",
                active
                  ? opt.activeClass
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {opt.label} ({counts[opt.value]})
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleListFilterBar({
  location,
  context,
  termFilter,
  onTermFilterChange,
  termCounts,
  search,
  onSearchChange,
}: {
  location: SupplierLocation;
  context: SupplierHubContext;
  termFilter: ScheduleTermFilterKey;
  onTermFilterChange: (value: ScheduleTermFilterKey) => void;
  termCounts: Record<ScheduleTermFilterKey, number>;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className={supplierHubFilterBarClass}>
      <div className={supplierHubFilterGridClass}>
        <ScheduleRouteLocationFilters value={location} context={context} />
        <ScheduleTermFilters
          value={termFilter}
          onChange={onTermFilterChange}
          counts={termCounts}
        />
        <SupplierHubSearchField
          id="schedule-supplier-search"
          value={search}
          onChange={onSearchChange}
          placeholder="Szukaj dostawcy…"
          ariaLabel="Szukaj dostawcy po nazwie"
        />
      </div>
    </div>
  );
}

export type { ScheduleTermFilterKey };
