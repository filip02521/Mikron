"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  SUPPLIER_LOCATION_OPTIONS,
  type SupplierLocationCounts,
  type SupplierLocationFilter,
} from "@/lib/supplier-locations";

function segmentLabel(base: string, count: number): string {
  return `${base} (${count})`;
}

export function SupplierLocationFilters({
  value,
  onChange,
  counts,
  className,
}: {
  value: SupplierLocationFilter;
  onChange: (value: SupplierLocationFilter) => void;
  counts: SupplierLocationCounts;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Filtr listy
        <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
          (bez zmiany strony)
        </span>
      </p>
      <SegmentedControl
        className="w-full max-w-full flex-wrap"
        value={value}
        onChange={onChange}
        ariaLabel="Filtr lokalizacji na liście kart"
        options={[
        {
          value: "all" as const,
          label: segmentLabel("Wszystkie", counts.all),
          title: "Wszyscy dostawcy",
        },
        ...SUPPLIER_LOCATION_OPTIONS.map((opt) => ({
          value: opt.value,
          label: segmentLabel(opt.label, counts[opt.value]),
          title: `Tylko ${opt.label}`,
        })),
      ]}
      />
    </div>
  );
}
