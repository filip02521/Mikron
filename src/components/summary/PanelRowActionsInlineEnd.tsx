"use client";

import type { ReactNode } from "react";
import {
  panelRowActionsInlineEndClass,
  panelRowActionsInlineEndContentClass,
  panelRowActionsInlineEndInnerClass,
} from "@/lib/ui/panel-row-actions-reveal";

/** Akcje po prawej z animacją hover — fade + slide + grid 0fr → 1fr. */
export function PanelRowActionsInlineEnd({
  forceVisible = false,
  className,
  contentClassName,
  children,
}: {
  forceVisible?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={panelRowActionsInlineEndClass({ forceVisible, className })}>
      <div className={panelRowActionsInlineEndInnerClass()}>
        <div className={panelRowActionsInlineEndContentClass({ forceVisible, className: contentClassName })}>
          {children}
        </div>
      </div>
    </div>
  );
}
