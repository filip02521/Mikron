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
        "shrink-0 text-[11px] transition hover:underline",
        className
      )}
    >
      {allExpanded ? "Zwiń wszystkie grupy" : "Rozwiń wszystkie grupy"}
    </button>
  );
}
