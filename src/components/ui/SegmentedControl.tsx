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
  /** compact = chrome h-8; dock = prep/dock h-9. */
  density?: "default" | "compact" | "dock";
  disabled?: boolean;
}) {
  const compact = density === "compact";
  const dock = density === "dock";
  const tight = compact || dock;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        // Przy wielu opcjach tor przewija się w poziomie; etykiet nie ucinamy.
        "inline-flex max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-slate-200/90 bg-slate-50/90 p-0.5 [scrollbar-width:thin]",
        compact && "h-10 items-stretch rounded-md border-slate-200/80 bg-card/70 sm:h-8",
        dock && "h-9 min-h-9 items-stretch rounded-md border-slate-200/80 bg-card/70",
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
              "shrink-0 cursor-pointer whitespace-nowrap rounded-[5px] font-medium transition-[background-color,color,box-shadow] duration-150 ease-out active:bg-card/90 active:text-slate-900",
              compact &&
                "flex-auto px-1.5 text-xs leading-none sm:flex-none sm:px-2.5 sm:text-[0.6875rem]",
              dock &&
                "flex-1 px-2 text-sm leading-none sm:flex-none sm:px-2.5",
              !tight && "px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
              touchFriendly &&
                !tight &&
                "min-h-10 flex-1 py-2.5 text-sm sm:flex-none sm:min-h-0 sm:py-1.5 sm:text-sm",
              active
                ? tight
                  ? "bg-card text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                  : "bg-card text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-card/70 hover:text-slate-900",
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
