"use client";

import { cn } from "@/lib/cn";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  title?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  touchFriendly = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  className?: string;
  touchFriendly?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full rounded-md border border-slate-200 bg-slate-50/80 p-0.5",
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
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-w-0 truncate rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm",
              touchFriendly && "min-h-10 flex-1 py-2.5 text-sm sm:flex-none sm:min-h-0 sm:py-1.5 sm:text-sm",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
