"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  SUPPLIER_LOCATION_OPTIONS,
  type SupplierLocationCounts,
  type SupplierLocationFilter,
} from "@/lib/supplier-locations";

function segmentLabel(base: string, count: number) {
  return (
    <>
      {base} <span className="tabular-nums text-slate-500">{count}</span>
    </>
  );
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
      <SegmentedControl
        className="max-w-full"
        value={value}
        onChange={onChange}
        ariaLabel="Lokalizacja dostawcy"
        touchFriendly
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
