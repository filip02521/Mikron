"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Subtelne rozwijanie / zwijanie treści toru (wysokość 0fr→1fr + lekki enter).
 * Treść zostaje w DOM, żeby zwijanie też się animowało.
 */
export function ProcurementRequestLaneCollapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "procurement-lane-expand-grid",
        open && "procurement-lane-expand-grid--open",
        className
      )}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div className="procurement-lane-expand-grid-inner">
        <div className="procurement-lane-expand-content">{children}</div>
      </div>
    </div>
  );
}
