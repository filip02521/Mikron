"use client";

import type { MojeSectionIconKind } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  mojeSectionDomId,
  mojeSectionHeadingDomId,
} from "@/lib/orders/moje-section-focus";

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
      className={cn(
        // Płaskie sekcje w jednej karcie (bez „karty w karcie”) — oddzielone cienką linią.
        "scroll-mt-24 border-t border-slate-200/70 first:border-t-0",
        className
      )}
      aria-labelledby={mojeSectionHeadingDomId(sectionIcon)}
    >
      {children}
    </div>
  );
}
