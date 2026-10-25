"use client";

import Link from "next/link";
import { Input } from "@/components/ui/Field";
import { SupplierLocationFilters } from "@/components/admin/SupplierLocationFilters";
import { AdminFilterChip } from "@/components/admin/AdminFilterChip";
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

/** Pasek filtrów (DESIGN.md → „Pasek filtrów”): jeden rząd, bez etykiet nad kontrolkami. */
export const supplierHubFilterBarClass =
  "flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-3 sm:px-4 lg:px-5";

export function SupplierHubResultCount({ children }: { children: React.ReactNode }) {
  return (
    <p className="ml-auto whitespace-nowrap text-[0.6875rem] tabular-nums text-slate-500" aria-live="polite">
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
    <div className={cn("order-first w-full min-w-0 sm:order-none sm:w-auto sm:min-w-[14rem] sm:max-w-xs sm:flex-1", className)}>
      <Input
        id={id}
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full"
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
  resultLabel,
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
  /** Licznik wyników na końcu paska, np. „206 dostawców”. */
  resultLabel?: string;
}) {
  return (
    <div className={supplierHubFilterBarClass}>
      <SupplierLocationFilters
        value={locationFilter}
        onChange={onLocationFilterChange}
        counts={locationCounts}
        className="max-w-full"
      />
      <SupplierHubSearchField
        id={searchId}
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel}
      />
      <SupplierSubiektFilters
        value={subiektFilter}
        onChange={onSubiektFilterChange}
        counts={subiektCounts}
      />
      {resultLabel ? <SupplierHubResultCount>{resultLabel}</SupplierHubResultCount> : null}
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
    <div className={cn("min-w-0 max-w-full", className)}>
      <div
        role="group"
        aria-label="Lokalizacja terminów"
        className="inline-flex max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-slate-200 bg-slate-50 p-0.5 [scrollbar-width:thin]"
      >
        {SUPPLIER_LOCATION_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Link
              key={opt.value}
              href={paths.schedule(opt.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-[5px] px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:min-h-0 sm:py-1.5",
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
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

const SCHEDULE_TERM_OPTIONS: { value: ScheduleTermFilterKey; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "overdue", label: "Po terminie" },
  { value: "week", label: "Ten tydzień" },
  { value: "vacation", label: "Z urlopem" },
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
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Filtr statusu terminu">
      {SCHEDULE_TERM_OPTIONS.map((opt) => (
        <AdminFilterChip
          key={opt.value}
          active={value === opt.value}
          label={opt.label}
          count={counts[opt.value]}
          onClick={() => onChange(opt.value)}
        />
      ))}
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
      <ScheduleRouteLocationFilters value={location} context={context} />
      <SupplierHubSearchField
        id="schedule-supplier-search"
        value={search}
        onChange={onSearchChange}
        placeholder="Szukaj dostawcy…"
        ariaLabel="Szukaj dostawcy po nazwie"
      />
      <ScheduleTermFilters
        value={termFilter}
        onChange={onTermFilterChange}
        counts={termCounts}
      />
    </div>
  );
}

export type { ScheduleTermFilterKey };
