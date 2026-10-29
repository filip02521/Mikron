"use client";

import { cn } from "@/lib/cn";
import { followUpQuickDates } from "@/lib/sales/notepad-follow-up";

export function FollowUpQuickDates({
  value,
  onPick,
  disabled,
  className,
}: {
  value?: string | null;
  onPick: (iso: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const options = followUpQuickDates();

  return (
    <div className={cn("flex flex-wrap gap-1", className)} role="group" aria-label="Szybki wybór daty">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(opt.value)}
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[0.625rem] font-medium transition disabled:opacity-50",
            value === opt.value
              ? "border-indigo-300 bg-indigo-50 text-indigo-800"
              : "border-slate-200/80 bg-card/80 text-slate-600 hover:border-slate-300 hover:bg-card"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
