"use client";

import { cn } from "@/lib/cn";

export function ZkWatchLineCheckboxControl({
  checked,
  toggleable,
  toneClass,
  ariaLabel,
  onToggle,
}: {
  checked: boolean;
  toggleable: boolean;
  toneClass: string;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={!toggleable}
      onClick={(event) => {
        event.stopPropagation();
        if (toggleable) onToggle();
      }}
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition",
        checked
          ? cn("border-transparent text-white shadow-sm", toneClass)
          : "border-slate-300 bg-white text-slate-300",
        toggleable ? "cursor-pointer hover:brightness-95" : "cursor-default opacity-80"
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className={cn("size-3", checked ? "opacity-100" : "opacity-0")}
        aria-hidden
      >
        <path
          d="M12.5 4.5 6.5 11 3.5 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
