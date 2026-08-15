"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Płynne pojawianie / znikanie paska akcji zaznaczenia
 * (wysokość 0fr→1fr + fade/slide). Szanuje prefers-reduced-motion.
 *
 * Parent powinien trzymać treść w DOM także przy zamykaniu (np. ostatni
 * selectedCount), żeby exit miał wysokość do zwinięcia.
 */
export function ZdEstimateSelectionToolsReveal({
  open,
  id,
  children,
  className,
}: {
  open: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "zd-estimate-selection-expand-grid",
        open && "zd-estimate-selection-expand-grid--open",
        className
      )}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div className="zd-estimate-selection-expand-grid-inner">
        <div className="zd-estimate-selection-expand-content">{children}</div>
      </div>
    </div>
  );
}
