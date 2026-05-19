"use client";

import { cn } from "@/lib/cn";
import { buttonGroupItemClass, buttonGroupShellClass } from "@/lib/ui/surfaces";

export function ButtonGroup({
  children,
  ariaLabel,
  className,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(buttonGroupShellClass, className)}
    >
      {children}
    </div>
  );
}

export function buttonGroupItemClassName(extra?: string) {
  return cn(buttonGroupItemClass, extra);
}
