"use client";

import type { ReactNode } from "react";
import {
  panelRowActionsInlineEndClass,
  panelRowActionsInlineEndContentClass,
  panelRowActionsInlineEndInnerClass,
} from "@/lib/ui/panel-row-actions-reveal";

/** Akcje po prawej z animacją hover — fade + slide (+ opcjonalnie grid 0fr–1fr). */
export function PanelRowActionsInlineEnd({
  forceVisible = false,
  reserveSpace = false,
  className,
  contentClassName,
  children,
}: {
  forceVisible?: boolean;
  /**
   * Stała szerokość slotu (bez 0fr→1fr). Hover tylko fade — nie ściska tytułu / planowego.
   */
  reserveSpace?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={panelRowActionsInlineEndClass({
        forceVisible,
        reserveSpace,
        className,
      })}
    >
      <div className={panelRowActionsInlineEndInnerClass()}>
        <div
          className={panelRowActionsInlineEndContentClass({
            forceVisible,
            reserveSpace,
            className: contentClassName,
          })}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
