"use client";

import { boardChipCountBadgeClass } from "@/lib/department-board/department-board-thread-styles";
import { cn } from "@/lib/cn";

export function DepartmentBoardCountBadge({
  count,
  active = false,
  emphasis = "default",
  className,
}: {
  count: number;
  active?: boolean;
  emphasis?: "default" | "warning" | "action";
  className?: string;
}) {
  return (
    <span className={cn(boardChipCountBadgeClass({ active, emphasis }), className)}>
      {count}
    </span>
  );
}
