"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  panelRowActionsFooterRevealClass,
  panelRowActionsFooterRevealContentClass,
  panelRowActionsFooterRevealInnerClass,
} from "@/lib/ui/panel-row-actions-reveal";

/**
 * Footer Główne/Uzupełniające — na hover (desktop) zwija się; wysuwa po ~450 ms na karcie.
 * Touch / forceVisible = zawsze widoczny. Wymaga `group/panelRow` na karcie / BlockBar.
 */
export function ProcurementRequestActionsFooter({
  forceVisible = false,
  className,
  children,
}: {
  forceVisible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={panelRowActionsFooterRevealClass({ forceVisible })}>
      <div className={panelRowActionsFooterRevealInnerClass()}>
        <div
          className={panelRowActionsFooterRevealContentClass({
            forceVisible,
            className: cn("border-t border-slate-100/90 px-2.5 py-1 sm:px-3", className),
          })}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
