"use client";

import { cn } from "@/lib/cn";
import { panelTextLinkClass } from "@/lib/ui/ontime-theme";

export function QueueGroupExpandControl({
  groupCount,
  allExpanded,
  onExpandAll,
  onCollapseAll,
  className,
}: {
  groupCount: number;
  allExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  className?: string;
}) {
  if (groupCount <= 1) return null;

  return (
    <button
      type="button"
      onClick={() => (allExpanded ? onCollapseAll() : onExpandAll())}
      className={cn(
        panelTextLinkClass,
        "inline-flex shrink-0 items-center gap-1 text-[10px] font-medium transition hover:underline",
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className={cn("size-3 shrink-0 transition-transform duration-200", allExpanded && "rotate-180")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {allExpanded ? (
          <path d="M3 7.5L6 4.5L9 7.5" />
        ) : (
          <path d="M3 4.5L6 7.5L9 4.5" />
        )}
      </svg>
      {allExpanded ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
    </button>
  );
}
