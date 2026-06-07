"use client";

import { cn } from "@/lib/cn";
import type { SupplierSubiektCounts, SupplierSubiektFilter } from "@/lib/supplier-locations";

const OPTIONS: { value: SupplierSubiektFilter; label: string; activeClass: string }[] = [
  { value: "all", label: "Wszyscy", activeClass: "bg-indigo-600 text-white" },
  {
    value: "unlinked",
    label: "Bez Subiekta",
    activeClass: "bg-amber-600 text-white",
  },
  { value: "linked", label: "Powiązani", activeClass: "bg-emerald-600 text-white" },
];

function chipLabel(base: string, count: number): string {
  return `${base} (${count})`;
}

export function SupplierSubiektFilters({
  value,
  onChange,
  counts,
  className,
}: {
  value: SupplierSubiektFilter;
  onChange: (value: SupplierSubiektFilter) => void;
  counts: SupplierSubiektCounts;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Subiekt
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr powiązania Subiekt">
        {OPTIONS.map((opt) => {
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
              {chipLabel(opt.label, counts[opt.value])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
