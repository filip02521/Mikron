"use client";

import { cn } from "@/lib/cn";
import { buttonGroupItemClass, buttonGroupShellClass, panelActionBarShellClass } from "@/lib/ui/surfaces";

export function ButtonGroup({
  children,
  ariaLabel,
  className,
  allowOverflow = false,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
  /** Menu rozwijane (Przesuń, ⋮) — bez obcinania przez overflow-hidden. */
  allowOverflow?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        allowOverflow ? panelActionBarShellClass : buttonGroupShellClass,
        className
      )}
    >
      {children}
    </div>
  );
}

export function buttonGroupItemClassName(extra?: string) {
  return cn(buttonGroupItemClass, extra);
}
