"use client";

import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import type { SupplierSubiektCounts, SupplierSubiektFilter } from "@/lib/supplier-locations";

const OPTIONS: { value: SupplierSubiektFilter; label: string }[] = [
  { value: "all", label: "Wszyscy" },
  { value: "unlinked", label: "Bez Subiekta" },
  { value: "linked", label: "Powiązani" },
];

/** Chip filtra z licznikiem — wygląd z „Jedno wybrane”. */
export function SupplierHubFilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 sm:min-h-9",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
      )}
    >
      {label}
      <span
        className={cn(
          "rounded px-1 text-[0.6875rem] tabular-nums",
          active ? "bg-white text-indigo-700" : "text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
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
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Powiązanie z Subiektem">
      {OPTIONS.map((opt) => (
        <SupplierHubFilterChip
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
