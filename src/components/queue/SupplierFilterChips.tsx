"use client";

import { cn } from "@/lib/cn";
import type { SupplierCountChip } from "@/lib/orders/supplier-filter-summary";

export function SupplierFilterChips({
  chips,
  value,
  onChange,
  totalLabel = "Wszyscy dostawcy",
}: {
  chips: SupplierCountChip[];
  value: string;
  onChange: (supplierKey: string) => void;
  totalLabel?: string;
}) {
  if (chips.length === 0) return null;

  const total = chips.reduce((n, c) => n + c.count, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">Dostawca</span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs font-medium transition",
            !value
              ? "border-slate-800 bg-slate-800 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          {totalLabel} ({total})
        </button>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            title={chip.key}
            onClick={() => onChange(value === chip.key ? "" : chip.key)}
            className={cn(
              "max-w-[14rem] truncate rounded-md border px-2.5 py-1 text-xs font-medium transition",
              value === chip.key
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50"
            )}
          >
            {chip.key} ({chip.count})
          </button>
        ))}
      </div>
    </div>
  );
}
