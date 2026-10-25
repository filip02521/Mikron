"use client";

import { cn } from "@/lib/cn";
import { AdminFilterChip } from "@/components/admin/AdminFilterChip";
import type { SupplierSubiektCounts, SupplierSubiektFilter } from "@/lib/supplier-locations";

const OPTIONS: { value: SupplierSubiektFilter; label: string }[] = [
  { value: "all", label: "Wszyscy" },
  { value: "unlinked", label: "Bez Subiekta" },
  { value: "linked", label: "Powiązani" },
];

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
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Powiązanie z Subiektem">
      {OPTIONS.map((opt) => (
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
