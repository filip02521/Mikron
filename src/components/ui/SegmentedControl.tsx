"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  title?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  touchFriendly = false,
  density = "default",
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  className?: string;
  touchFriendly?: boolean;
  /** Compact = belka listy / chrome (zewnętrzne h-8). */
  density?: "default" | "compact";
  disabled?: boolean;
}) {
  const compact = density === "compact";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex max-w-full rounded-md border border-slate-200/90 bg-slate-50/90 p-0.5",
        compact && "h-8 items-stretch rounded-md border-slate-200/80 bg-white/70",
        disabled && "opacity-60",
        className
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-w-0 truncate rounded-[5px] font-medium transition",
              compact
                ? "flex-1 px-1.5 text-[10px] leading-none sm:flex-none sm:px-2.5 sm:text-[11px]"
                : "px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
              touchFriendly &&
                !compact &&
                "min-h-10 flex-1 py-2.5 text-sm sm:flex-none sm:min-h-0 sm:py-1.5 sm:text-sm",
              active
                ? compact
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                  : "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
              disabled &&
                "cursor-not-allowed hover:bg-transparent hover:text-slate-600"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
