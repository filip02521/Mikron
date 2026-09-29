"use client";

import type { MojeSectionIconKind } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  mojeSectionDomId,
  mojeSectionHeadingDomId,
} from "@/lib/orders/moje-section-focus";
import { mojeShipmentSectionShellClass } from "@/lib/ui/moje-shipment-row-styles";

/** Karta sekcji listy /moje — cel scrollu i podświetlenia Start dnia. */
export function MojeSectionShell({
  sectionIcon,
  children,
  className,
}: {
  sectionIcon: MojeSectionIconKind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={mojeSectionDomId(sectionIcon)}
      className={cn(mojeShipmentSectionShellClass, "scroll-mt-24", className)}
      aria-labelledby={mojeSectionHeadingDomId(sectionIcon)}
    >
      {children}
    </div>
  );
}
