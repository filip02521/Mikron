"use client";

import { cn } from "@/lib/cn";
import { ZD_PACKAGING_LABEL_PRESETS } from "@/lib/orders/zd-estimate-packaging";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

export function ZdPackagingLabelPresets({
  value,
  onSelect,
  disabled,
  className,
}: {
  value: string;
  onSelect: (label: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const current = value.trim();
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label={ZD_ESTIMATE_UI.packagingLabelPresetsAria}
    >
      {ZD_PACKAGING_LABEL_PRESETS.map((preset) => {
        const active = current === preset;
        return (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onSelect(preset)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium ring-1 transition",
              active
                ? "bg-indigo-50 text-indigo-950 ring-indigo-200"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}
