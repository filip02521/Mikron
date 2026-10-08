"use client";

import { IconMinus, IconPlus } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

/** Przycisk −/+ krokomierza ilości — 44 px na telefonie, zwarty od sm. */
export function QtyStepButton({
  direction,
  label,
  disabled,
  onClick,
  size = "md",
}: {
  direction: "down" | "up";
  label: string;
  disabled?: boolean;
  onClick: () => void;
  /** `sm` — w wierszu tabeli (np. grupy zębów). */
  size?: "sm" | "md";
}) {
  const Icon = direction === "down" ? IconMinus : IconPlus;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-[background-color,transform] duration-100 hover:bg-slate-50 active:scale-95 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "md" ? "h-11 w-11" : "h-10 w-10 sm:h-8 sm:w-8"
      )}
    >
      <Icon size={size === "md" ? 18 : 14} strokeWidth={2.25} aria-hidden />
    </button>
  );
}
