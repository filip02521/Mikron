"use client";

import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";

/** Chip filtra z licznikiem — wygląd z „Jedno wybrane”. */
export function AdminFilterChip({
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
